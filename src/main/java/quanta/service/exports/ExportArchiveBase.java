package quanta.service.exports;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.text.StringEscapeUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.TreeNode;
import quanta.model.client.Attachment;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.ExportRequest;
import quanta.response.ExportResponse;
import quanta.util.ExUtil;
import quanta.util.FileUtils;
import quanta.util.StreamUtil;
import quanta.util.ThreadLocals;
import quanta.util.XString;
import quanta.util.val.Val;

/**
 * Base class for exporting to archives (ZIP and TAR).
 *
 * NOTE: Derived classes are expected to be 'prototype' scope so we can keep state in this object on
 * a per-export basis. That is, each time a user does an export, a new instance of this class is
 * created that is dedicated just do doing that one export and so any member varibles in this class
 * have just that one export as their 'scope'
 */
public abstract class ExportArchiveBase extends ServiceBase {
    @SuppressWarnings("unused")
    private static Logger log = LoggerFactory.getLogger(ExportArchiveBase.class);
    private String shortFileName;
    private String fullFileName;
    private String rootPathParent;
    ExportRequest req;
    int baseSlashCount = 0;

    private class MarkdownLink {
        String description;
        String link;

        MarkdownLink(String description, String link) {
            this.description = description;
            this.link = link;
        }
    }

    private class MarkdownFile {
        String fileName;

        // allows us to generate headings sizes (#, ##, ###, etc) relative to the file.
        int baseSlashCount = 0;

        // used only to detect name collisions so the record number will be used for decollision
        HashSet<String> attachmentNames = new HashSet<>();

        StringBuilder content = new StringBuilder();
        StringBuilder toc = new StringBuilder();

        MarkdownFile(String fileName, String content, int baseSlashCount) {
            this.fileName = fileName;
            this.content.append(content);
            this.baseSlashCount = baseSlashCount;
        }
    }

    /*
     * It's possible that nodes recursively contained under a given node can have same name, so we have
     * to detect that and number them, so we use this hashset to detect existing filenames.
     */
    private final HashSet<String> fileNameSet = new HashSet<>();
    private MongoSession session;
    private StringBuilder fullHtml = new StringBuilder();

    // this is the stack of TreeNodes of the paths for named markdown files. Only is used as a prefix
    // for nodes that specify 'file' property
    private List<SubNode> mdPaths = new ArrayList<>();
    private MarkdownFile mdFile = null;
    private List<MarkdownFile> mdFiles = new ArrayList<>();
    private List<MarkdownFile> pendingFileWrites = new ArrayList<>();

    private HashMap<String, MarkdownFile> markdownFilesByNodeName = new HashMap<>();

    // markdown links keyed by link url
    private HashMap<String, MarkdownLink> markdownLinks = new HashMap<>();

    private StringBuilder htmlToc = new StringBuilder();

    public void export(MongoSession ms, ExportRequest req, ExportResponse res) {
        ms = ThreadLocals.ensure(ms);
        this.req = req;
        this.session = ms;
        if (!FileUtils.dirExists(prop.getAdminDataFolder())) {
            throw ExUtil.wrapEx("adminDataFolder does not exist: " + prop.getAdminDataFolder());
        }
        String nodeId = req.getNodeId();

        TreeNode rootNode = read.getSubGraphTree(ms, nodeId, null, null);
        SubNode node = rootNode.node;

        String fileName = snUtil.getExportFileName(req.getFileName(), node);
        shortFileName = fileName + "." + getFileExtension();
        fullFileName = prop.getAdminDataFolder() + File.separator + shortFileName;
        if (req.isUpdateHeadings()) {
            baseSlashCount = StringUtils.countMatches(node.getPath(), "/");
        }
        boolean success = false;
        try {
            openOutputStream(fullFileName);
            if (req.isIncludeHTML()) {
                writeRootFiles();
            }
            rootPathParent = node.getParentPath();
            auth.ownerAuth(ms, node);
            ArrayList<SubNode> nodeStack = new ArrayList<>();
            nodeStack.add(node);

            // process the entire exported tree here
            recurseNode("../", "", rootNode, nodeStack, 0, null);

            writePendingFiles();

            if (req.isIncludeHTML()) {
                StringBuilder out = new StringBuilder();
                appendHtmlBegin("", out);
                if (htmlToc.length() > 0) {
                    out.append("<div class='toc'>Table of Contents</div>\n");
                    out.append(htmlToc);
                }
                out.append(fullHtml);
                appendHtmlEnd("", out);
                addFileEntry("content.html", out.toString().getBytes(StandardCharsets.UTF_8));
            }

            res.setFileName(shortFileName);
            success = true;
        } catch (Exception ex) {
            throw ExUtil.wrapEx(ex);
        } finally {
            closeOutputStream();
            if (!success) {
                FileUtils.deleteFile(fullFileName);
            }
        }
    }

    private void writePendingFiles() {
        pendingFileWrites.forEach(mdf -> {
            String content = mdf.content.toString();
            // translate all the links to markdown compatable links
            if (content.contains("](")) {
                Iterator iter = markdownLinks.entrySet().iterator();
                while (iter.hasNext()) {
                    Map.Entry entry = (Map.Entry) iter.next();
                    MarkdownLink value = (MarkdownLink) entry.getValue();
                    content =
                            content.replace("](" + value.link + ")", "](" + translateToMarkdownLink(value.link) + ")");
                }
            }

            addFileEntry(mdf.fileName, content.getBytes(StandardCharsets.UTF_8));
        });
    }

    private String translateToMarkdownLink(String link) {
        // for now this will only always work for '/n/link' type links owned by admin
        String nodeName = XString.parseAfterLast(link, "/");
        MarkdownFile mkf = markdownFilesByNodeName.get(nodeName);
        if (mkf != null) {
            return mkf.fileName;
        }
        return link;
    }

    private void writeRootFiles() {
        // These files are how our exported HTML content get the ability to render markdown content.
        writeRootFile("exported.js");
        writeRootFile("marked.min.js");
        writeRootFile("exported.css");
    }

    private void writeRootFile(String fileName) {
        InputStream is = null;
        String resourceName = "classpath:/public/export-includes/" + fileName;
        try {
            Resource resource = context.getResource(resourceName);
            is = resource.getInputStream();
            byte[] targetArray = IOUtils.toByteArray(is);
            addFileEntry(fileName, targetArray);
        } catch (Exception e) {
            throw new RuntimeEx("Unable to write resource: " + resourceName, e);
        } finally {
            StreamUtil.close(is);
        }
    }

    private void recurseNode(String rootPath, String parentFolder, TreeNode tn, ArrayList<SubNode> nodeStack, int level,
            String parentId) {
        SubNode node = tn.node;
        if (node == null)
            return;
        // If a node has a property "noexport" (added by power users) then this node will not be exported.
        String noExport = node.getStr(NodeProp.NO_EXPORT);
        if (noExport != null) {
            return;
        }

        boolean hasFileProp = false;
        boolean hasFolderProp = false;
        String pathContent = null;

        if (req.isIncludeMD()) {
            String mdFileName = node.getStr(NodeProp.FILE_NAME);
            String folderName = node.getStr(NodeProp.FOLDER_NAME);

            // if we're at the top level and there's no file name specified, then we use the default
            if (mdFileName == null && level == 0) {
                mdFileName = "index.md";
            }

            if (folderName != null) {
                hasFolderProp = true;
                mdPaths.add(node);
            }

            if (mdFileName != null) {
                mdFileName = buildMdPaths() + mdFileName;

                if (mdFile != null) {
                    mdFile.content.append("\n### [" + mdFileName + "](" + mdFileName + ")\n");
                }

                int bsc = StringUtils.countMatches(node.getPath(), "/");
                pathContent = buildMdPathContent();
                mdFile = new MarkdownFile(mdFileName, "", bsc);
                mdFiles.add(mdFile);
                hasFileProp = true;
            }
        }

        if (mdFiles != null && StringUtils.isNotEmpty(node.getName())) {
            markdownFilesByNodeName.put(node.getName(), mdFile);
        }

        /* process the current node */
        Val<String> fileName = new Val<>();
        /*
         * This is the header row at the top of the page. The rest of the page is children of this node
         */
        processNodeExport(session, parentFolder, "", node, true, fileName, level, true);
        String folder = node.getIdStr();

        if (tn.children != null) {
            for (TreeNode c : tn.children) {
                String noExp = c.node.getStr(NodeProp.NO_EXPORT);
                if (noExp != null) {
                    continue;
                }
                nodeStack.add(c.node);
                recurseNode(rootPath + "../", parentFolder + "/" + folder, c, nodeStack, level + 1, c.node.getIdStr());
                nodeStack.remove(c.node);
            }
        }

        if (hasFileProp && mdFile != null) {
            // if we're at root leval and have table of contents prepend it.
            if (mdFile.toc.length() > 0) {
                // todo-1: this is disabled for now because it's not working correctly in VSCode (haven't tried in
                // github viewer)
                mdFile.content.insert(0, pathContent /* + "Table of Contents\n\n" + mdFile.toc.toString() + "\n" */);
            } else {
                mdFile.content.insert(0, pathContent);
            }

            pendingFileWrites.add(mdFile);
            mdFiles.remove(mdFiles.size() - 1);
            mdFile = mdFiles.size() > 0 ? mdFiles.get(mdFiles.size() - 1) : null;
        }

        if (hasFolderProp) {
            mdPaths.remove(mdPaths.size() - 1);
        }
    }

    private String buildMdPathContent() {
        StringBuilder sb = new StringBuilder();
        for (SubNode node : mdPaths) {
            if (sb.length() > 0)
                sb.append("/");
            sb.append(node.getStr(NodeProp.FOLDER_NAME));
        }

        // put a divider between the path content and the node content
        if (sb.length() > 0)
            return "**" + sb.toString() + "**\n\n";

        return "";
    }

    private String buildMdPaths() {
        StringBuilder sb = new StringBuilder();
        for (SubNode node : mdPaths) {
            sb.append(node.getStr(NodeProp.FOLDER_NAME));
            sb.append("/");
        }
        return sb.toString();
    }

    private void appendHtmlBegin(String rootPath, StringBuilder html) {
        html.append("<html>");
        html.append("<head>\n");
        html.append("<link rel='stylesheet' href='" + rootPath + "exported.css' />");
        html.append("</head>\n");
        html.append("<body>\n");
    }

    private void appendHtmlEnd(String rootPath, StringBuilder html) {
        html.append("<script src='" + rootPath + "marked.min.js'></script>");
        html.append("<script src='" + rootPath + "exported.js'></script>");
        html.append("</body></html>");
    }

    /*
     * NOTE: It's correct that there's no finally block in here enforcing the closeEntry, because we let
     * exceptions bubble all the way up to abort and even cause the zip file itself (to be deleted)
     * since it was unable to be written to completely successfully.
     *
     * fileNameCont is an output parameter that has the complete filename minus the period and
     * extension.
     */
    private void processNodeExport(MongoSession ms, String parentFolder, String deeperPath, SubNode node,
            boolean writeFile, Val<String> fileNameCont, int level, boolean isTopRow) {
        try {
            String nodeId = node.getIdStr();
            String fileName = nodeId;
            String content = node.getContent() != null ? node.getContent() : "";
            parseMarkdownLinks(content);
            content = content.trim();

            if (req.isUpdateHeadings()) {
                int slashCount = StringUtils.countMatches(node.getPath(), "/");

                // base slash count is the number of slashes in the path of the root node, and is relative
                // to the markdown file we're writing to if there is one.
                int lev = slashCount - (mdFile != null ? mdFile.baseSlashCount : baseSlashCount);
                if (lev > 6)
                    lev = 6;
                boolean isFileNode = node.getStr(NodeProp.FILE_NAME) != null;
                content = edit.translateHeadingsForLevel(ms, content, lev, mdFile != null && isFileNode);
            }

            if (writeFile && req.isIncludeToc()) {
                addToTableOfContents(level, content, nodeId);
            }

            List<Attachment> atts = node.getOrderedAttachments();
            // we save off the 'content' into htmlContent, because we need a copy that doesn't have
            // attachments inserted into it for the special case of inserting HTML attachments
            Val<String> htmlContent = new Val<>(content);
            Val<String> mdContent = new Val<>(content);
            String targetFolder = null;

            // if we have a markdown file, all the attachments go into that folder
            if (mdFile != null) {
                targetFolder = fileUtil.getParentPath(mdFile.fileName);
            } else {
                targetFolder = req.isAttOneFolder() ? "/attachments" : ("." + parentFolder);
            }

            // Process all attachments just to insert File Tags into content
            if (atts != null) {
                for (Attachment att : atts) {
                    // Process File Tag type attachments here first
                    if (!"ft".equals(att.getPosition())) {
                        continue;
                    }
                    handleAttachment(node, true, null, mdContent, deeperPath, targetFolder, writeFile, nodeId, fileName,
                            att);
                }
            }

            if (req.isIncludeHTML()) {
                htmlContent.setVal(formatContentToHtml(node, htmlContent.getVal()));
                // special handling for htmlContent we have to do this File Tag injection AFTER the html escaping
                // and processing that's done in the line above
                if (atts != null) {
                    for (Attachment att : atts) {
                        // Process File Tag type attachments here first
                        if (!"ft".equals(att.getPosition())) {
                            continue;
                        }
                        handleAttachment(node, true, htmlContent, null, deeperPath, targetFolder, writeFile, nodeId,
                                fileName, att);
                    }
                }
                fullHtml.append(htmlContent.getVal());
            }

            if (req.isIncludeMD()) {
                // if appending to specific named markdown file
                if (mdFile != null) {
                    if (mdFile.content.length() > 0)
                        mdFile.content.append("\n");
                    mdFile.content.append(mdContent.getVal() + "\n");
                }
            }

            if (atts != null) {
                for (Attachment att : atts) {
                    // Skip File Tag type attachments because they'll already have been processed above
                    if ("ft".equals(att.getPosition())) {
                        continue;
                    }
                    handleAttachment(node, false, null, null, deeperPath, targetFolder, writeFile, nodeId, fileName,
                            att);
                }
            }

            if (req.isIncludeHTML()) {
                fullHtml.append("</div>\n");
            }
            if (writeFile) {
                writeFilesForNode(ms, parentFolder, node, fileNameCont, fileName, content, atts);
            }
        } catch (Exception ex) {
            throw ExUtil.wrapEx(ex);
        }
    }

    private void addToTableOfContents(int level, String content, String nodeId) {
        // add to table of contents
        if (content == null)
            return;
        String headerContent = content.trim();
        if (XString.isMarkdownHeading(headerContent)) {
            // chop string at newline if there's a newline
            int newLineIdx = content.indexOf("\n");
            if (newLineIdx != -1) {
                headerContent = headerContent.substring(0, newLineIdx);
            }
            int firstSpace = headerContent.indexOf(" ");
            if (firstSpace != -1) {
                String heading = headerContent.substring(firstSpace + 1);
                String linkHeading = heading.replace(" ", "-").toLowerCase();
                level--;
                String prefix = level > 0 ? "    ".repeat(level) : "";
                if (mdFile != null) {
                    mdFile.toc.append(prefix + "* [" + heading + "](#" + linkHeading + ")\n");
                }
                String clazz = level == 0 ? "class='topLevelToc'" : "";
                htmlToc.append(
                        "<div " + clazz + " style='margin-left: " + (25 + level * 25) + "px'><a class='tocLink' href='#"
                                + nodeId + "'>" + StringEscapeUtils.escapeHtml4(heading) + "</a></div>");
            }
        }
    }

    private void writeFilesForNode(MongoSession ms, String parentFolder, SubNode node, Val<String> fileNameCont,
            String fileName, String content, List<Attachment> atts) {
        String fileNameBase = parentFolder + "/" + fileName + "/" + fileName;
        fileNameCont.setVal(fileNameBase);
        String json = getNodeJson(node);
        if (req.isIncludeJSON()) {
            addFileEntry(fileNameBase + ".json", json.getBytes(StandardCharsets.UTF_8));
        }
        if (atts != null) {
            for (Attachment att : atts) {
                writeAttachmentFileForNode(ms, parentFolder, node, fileName, att);
            }
        }
    }

    private String getNodeJson(SubNode node) {
        String json;
        /*
         * Pretty print the node having the relative path, and then restore the node to the full path
         */
        String fullPath = node.getPath();
        String relPath = fullPath.substring(rootPathParent.length());
        try {
            node.directSetPath(relPath);
            json = XString.prettyPrint(node);
        } finally {
            node.directSetPath(fullPath);
        }
        return json;
    }

    private String getAttachmentFileName(Attachment att, SubNode node) {
        String fileName = att.getFileName();

        // we have some possibility of fileName being an actual URL that it was downloaded from so we don't
        // let those be used here and fall back to the key instead
        if (fileName == null || fileName.indexOf("/") != -1) {
            fileName = att.getKey();
        }

        // Some software chokes on spaces in filenames (like VSCode markdown preview), so don't allow that.
        fileName = fileName.replace(" ", "_");

        // if dumping all attachments into one folder, prepend the node id to the filename
        if (req.isAttOneFolder()) {
            fileName = node.getIdStr() + "-" + fileName;
        }
        return fileName;
    }

    private void writeAttachmentFileForNode(MongoSession ms, String parentFolder, SubNode node, String fileName,
            Attachment att) {
        String ext = null;
        String attFileName = getAttachmentFileName(att, node);
        ext = FilenameUtils.getExtension(attFileName);
        if (!StringUtils.isEmpty(ext)) {
            ext = "." + ext;
        }

        /*
         * If we had a binary property on this node we write the binary file into a separate file, but for
         * ipfs links we do NOT do this
         */
        if (att.getMime() != null) {
            InputStream is = null;
            try {
                is = attach.getStream(ms, att.getKey(), node, false);
                if (is == null)
                    return;
                BufferedInputStream bis = new BufferedInputStream(is);
                long length = att != null ? att.getSize() : null;

                String binFileName = null;
                if (mdFile != null) {
                    if (!mdFile.attachmentNames.add(attFileName)) {
                        throw new RuntimeException("Attachment " + attFileName + " is used twice in the same file");
                    }

                    String attFolder = fileUtil.getParentPath(mdFile.fileName);
                    binFileName = attFolder + "/attachments/" + attFileName;
                } else {
                    binFileName = req.isAttOneFolder() ? ("/attachments/" + fileName + "-" + att.getKey() + ext)
                            : (parentFolder + "/" + fileName + "/" + att.getKey() + ext);
                }


                if (length > 0) {
                    /* NOTE: the archive WILL fail if no length exists in this codepath */
                    addFileEntry(binFileName, bis, length);
                } else {
                    /*
                     * This *should* never happen that we fall back to writing as an array from the input stream because
                     * normally we will always have the length saved on the node. But re are trying to be as resilient
                     * as possible here falling back to this rather than failing the entire export
                     */
                    addFileEntry(binFileName, IOUtils.toByteArray(bis));
                }
            } catch (Exception e) {
                throw ExUtil.wrapEx(e);
            } finally {
                StreamUtil.close(is);
            }
        }
    }

    /*
     * If 'content' is passes as non-null then the ONLY thing we do is inject any File Tags onto that
     * content and return the content
     */
    private void handleAttachment(SubNode node, boolean injectingTag, Val<String> htmlContent, Val<String> mdContent,
            String deeperPath, String parentFolder, boolean writeFile, String nodeId, String fileName, Attachment att) {
        String ext = null;
        String attFileName = getAttachmentFileName(att, node);

        ext = FilenameUtils.getExtension(attFileName);
        if (!StringUtils.isEmpty(ext)) {
            ext = "." + ext;
        }

        String displayName = att.getFileName() != null ? att.getFileName() : attFileName;
        String mimeType = att.getMime();
        String fullUrl = null;

        if (mdFile != null) {
            String attFolder = fileUtil.getParentPath(mdFile.fileName);
            fullUrl = attFolder + "/attachments/" + attFileName;
        } else {
            fullUrl = parentFolder + "/" + fileName + (req.isAttOneFolder() ? "-" : "/") + att.getKey() + ext;
        }

        String relPath = writeFile ? "" : (fileName + "/");
        String url = att.getUrl();

        // if no exernal link, this is a local file so build path to it.
        if (url == null) {
            url = "./" + deeperPath + relPath + att.getKey() + ext;
        } else {
            displayName = "Image";
            fullUrl = url;
        }

        if (mimeType == null)
            return;

        if (mimeType.startsWith("image/")) {
            if (req.isIncludeHTML()) {
                String htmlLink = appendImgLink(nodeId, displayName, fullUrl);
                processHtmlAtt(injectingTag, htmlContent, att, htmlLink);
            }
            if (req.isIncludeMD()) {
                String mdLink = "\n![" + displayName + "](" + fullUrl + ")\n";
                processMdAtt(injectingTag, mdContent, att, mdLink);
            }
        } else {
            if (req.isIncludeHTML()) {
                String htmlLink = appendNonImgLink(displayName, fullUrl);
                processHtmlAtt(injectingTag, htmlContent, att, htmlLink);
            }
            if (req.isIncludeMD()) {
                String mdLink = "\n[" + displayName + "](" + fullUrl + ")\n";
                processMdAtt(injectingTag, mdContent, att, mdLink);
            }
        }
    }

    private void processHtmlAtt(boolean injectingTag, Val<String> htmlContent, Attachment att, String imgLink) {
        if (injectingTag) {
            if (htmlContent != null) {
                htmlContent.setVal(insertHtmlLink(htmlContent.getVal(), att, imgLink));
            }
        } else {
            fullHtml.append(imgLink);
        }
    }

    private void processMdAtt(boolean injectingTag, Val<String> mdContent, Attachment att, String mdLink) {
        if (injectingTag) {
            if (mdContent != null) {
                mdContent.setVal(insertMdLink(mdContent.getVal(), att, mdLink));
            }
        } else {
            if (req.isIncludeMD()) {
                if (mdFile != null) {
                    mdFile.content.append(mdLink);
                }
            }
        }
    }

    // todo-0: retest this code path
    private String insertHtmlLink(String content, Attachment att, String imgLink) {
        if ("ft".equals(att.getPosition())) {
            // This replacement is kind of tricky because we have to close out the markdown div
            // then inject our HTML, and then reopen a new div so keep the markdown separate from the
            // RAW html "imgLink" we're inserting here.
            content = content.replace("{{" + att.getFileName() + "}}",
                    "\n</div>" + imgLink + "<div class='markdown container'>\n");
        }
        return content;
    }

    private String insertMdLink(String content, Attachment att, String mdLink) {
        if ("ft".equals(att.getPosition())) {
            content = content.replace("{{" + att.getFileName() + "}}", mdLink);
        }
        return content;
    }

    private String appendImgLink(String nodeId, String binFileNameStr, String url) {
        return ("<div class='attachment'><img title='" + binFileNameStr + "' id='img_" + nodeId
                + "' style='width:50%' onclick='document.getElementById(\"img_" + nodeId + "\").style.width=\"\"' src='"
                + url + "'/></div>");
    }

    private String appendNonImgLink(String binFileNameStr, String url) {
        return ("<div class='attachment'><a class='link' target='_blank' href='" + url + "'>" + binFileNameStr
                + "</a></div>");
    }

    private String formatContentToHtml(SubNode node, String content) {
        String escapedContent = StringEscapeUtils.escapeHtml4(content);
        if (node.isType(NodeType.PLAIN_TEXT)) {
            return "\n<pre>" + escapedContent + "\n</pre>\n";
        } else {
            String prefix = "";
            if (req.isDividerLine()) {
                prefix += "<hr>";
            }
            if (req.isIncludeIDs()) {
                prefix += "\n<div class='floatContainer'><div class='floatRight'>\nID:" + node.getIdStr()
                        + "</div></div>";
            }
            return prefix + "\n<div id='" + node.getIdStr() + "' class='markdown container'>" + escapedContent
                    + "\n</div>\n";
        }
    }

    private void addFileEntry(String fileName, byte[] bytes) {
        /*
         * If we have duplicated a filename, number it sequentially to create a unique file
         */
        if (fileNameSet.contains(fileName)) {
            int idx = 1;
            String numberedFileName = fileName + String.valueOf(idx);

            while (fileNameSet.contains(numberedFileName)) {
                numberedFileName = fileName + String.valueOf(++idx);
            }
            fileName = numberedFileName;
        }
        fileNameSet.add(fileName);
        addEntry(fileName, bytes);
    }

    private void addFileEntry(String fileName, InputStream is, long length) {
        if (length <= 0) {
            throw new RuntimeEx("length is required");
        }
        /*
         * If we have duplicated a filename, number it sequentially to create a unique file
         */
        if (fileNameSet.contains(fileName)) {
            int idx = 1;
            String numberedFileName = fileName + String.valueOf(idx);

            while (fileNameSet.contains(numberedFileName)) {
                numberedFileName = fileName + String.valueOf(++idx);
            }
            fileName = numberedFileName;
        }
        fileNameSet.add(fileName);
        addEntry(fileName, is, length);
    }

    public void parseMarkdownLinks(String mkdown) {
        // Regex pattern to match the Markdown links
        String regex = "\\[([^\\]]+)\\]\\(([^\\)]+)\\)";

        // Compile the regex pattern
        Pattern pattern = Pattern.compile(regex);

        // Match the pattern in the mkdown string
        Matcher matcher = pattern.matcher(mkdown);

        while (matcher.find()) {
            // Extract the description and link
            String description = matcher.group(1);
            String link = matcher.group(2);

            if (link.startsWith("/")) {
                markdownLinks.put(link, new MarkdownLink(description, link));

                // Print the description and link
                log.debug("Description: " + description + " Link: " + link);
            }
        }
    }

    public abstract String getFileExtension();

    public abstract void openOutputStream(String fileName);

    public abstract void closeOutputStream();

    public abstract void addEntry(String fileName, byte[] bytes);

    public abstract void addEntry(String fileName, InputStream stream, long length);
}
