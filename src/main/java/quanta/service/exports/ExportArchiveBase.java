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
import quanta.util.MimeTypeUtils;
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
    private static Logger log = LoggerFactory.getLogger(ExportArchiveBase.class);
    private String shortFileName;
    private String fullFileName;
    private String rootPathParent;
    ExportRequest req;
    int baseSlashCount = 0;

    /*
     * This master toc works great, but it's a bit confusing having toc type info on each page AND in a
     * single file because then there's more than just one obvious 'page flow' to get to any content.
     * Also if we bring this back we probably need some way to make nodes that have child nodes that are
     * all file be excluded from the master index because again it just kind of creates a confusing flow
     * for the user
     */
    boolean useMasterToc = false;

    // warnings and issues will be written to 'problems.txt' if there were any issues with the export
    StringBuilder problems = new StringBuilder();

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
        String title;

        // allows us to generate headings sizes (#, ##, ###, etc) relative to the file.
        int baseSlashCount = 0;

        // used only to detect name collisions so the record number will be used for decollision
        HashSet<String> attachmentNames = new HashSet<>();

        StringBuilder content = new StringBuilder();
        StringBuilder toc = new StringBuilder();
        StringBuilder mtoc = new StringBuilder(); // master toc
        int tocCount = 0;

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
    private SubNode node;

    public void export(MongoSession ms, ExportRequest req, ExportResponse res) {
        ms = ThreadLocals.ensure(ms);

        // for markdown force updateHeadings and Attachments folder
        if (req.getContentType().equals("md")) {
            req.setUpdateHeadings(true);
            req.setAttOneFolder(true);
        }

        this.req = req;
        this.session = ms;
        if (!FileUtils.dirExists(prop.getAdminDataFolder())) {
            throw ExUtil.wrapEx("adminDataFolder does not exist: " + prop.getAdminDataFolder());
        }
        String nodeId = req.getNodeId();
        TreeNode rootNode = read.getSubGraphTree(ms, nodeId, null, null);
        node = rootNode.node;

        String fileName = snUtil.getExportFileName(req.getFileName(), node);
        shortFileName = fileName + "." + getFileExtension();
        fullFileName = prop.getAdminDataFolder() + File.separator + shortFileName;
        if (req.isUpdateHeadings()) {
            baseSlashCount = StringUtils.countMatches(node.getPath(), "/");
        }
        boolean success = false;
        try {
            openOutputStream(fullFileName);
            if (req.getContentType().equals("html")) {
                writeRootFiles();
            }
            rootPathParent = node.getParentPath();
            auth.ownerAuth(ms, node);
            ArrayList<SubNode> nodeStack = new ArrayList<>();
            nodeStack.add(node);

            // process the entire exported tree here
            recurseNode("../", "", rootNode, nodeStack, 0, null);

            writePendingFiles();
            writeMarkdownMasterToc();

            if (problems.length() > 0) {
                addFileEntry("export-info.txt", problems.toString().getBytes(StandardCharsets.UTF_8));
            }

            if (req.getContentType().equals("html")) {
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
        for (int i = 0; i < pendingFileWrites.size(); i++) {
            MarkdownFile mdf = pendingFileWrites.get(i);
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

            if (req.isIncludeToc()) {
                MarkdownFile nextFile = i < pendingFileWrites.size() - 1 ? pendingFileWrites.get(i + 1) : null;
                if (nextFile != null) {
                    content += "\n\n----\n**[Next: " + nextFile.title + "](" + nextFile.fileName + ")**\n";
                }
            }

            if (useMasterToc) {
                String rootFolder = node.getStr(NodeProp.FOLDER_NAME);
                if (rootFolder != null) {
                    content = "[Table of Contents](/" + rootFolder + "/table-of-contents.md)\n\n" + content;
                }
            }
            addFileEntry(mdf.fileName, content.getBytes(StandardCharsets.UTF_8));
        }
    }

    private void writeMarkdownMasterToc() {
        if (!useMasterToc)
            return;
        String rootFolder = node.getStr(NodeProp.FOLDER_NAME);
        if (rootFolder == null)
            return;

        StringBuilder toc = new StringBuilder();
        for (MarkdownFile mf : pendingFileWrites) {
            toc.append(mf.mtoc);
            toc.append("\n");
        }
        if (toc.length() > 0) {
            addFileEntry("/" + rootFolder + "/table-of-contents.md", toc.toString().getBytes(StandardCharsets.UTF_8));
        }
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

        if (req.getContentType().equals("md")) {
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
                String paths = buildMdPaths();
                if (paths.length() > 0 && mdFileName.indexOf("/") != 0) {
                    paths += "/";
                }
                mdFileName = paths + mdFileName;

                if (mdFile != null) {
                    // DO NOT DELETE (I may go back to showing path as the link name)
                    // String displayPath = mdFileName;
                    // // remove '/index.md' from the end of the path if it's there
                    // if (displayPath.endsWith("/index.md")) {
                    // displayPath = displayPath.substring(0, mdFileName.length() - 9);
                    // }
                    // // only show the last part of the path
                    // displayPath = XString.parseAfterLast(displayPath, "/");

                    mdFile.content.append("\n### [" + getShortNodeText(node.getContent()) + "](" + mdFileName + ")\n");
                }

                int bsc = StringUtils.countMatches(node.getPath(), "/");
                pathContent = buildMdPathContent();
                mdFile = new MarkdownFile(mdFileName, "", bsc);
                mdFiles.add(mdFile);
                hasFileProp = true;
                pendingFileWrites.add(mdFile);
            }
        }

        // if this node has a name associate it with the current mdFile
        if (mdFiles != null && StringUtils.isNotEmpty(node.getName())) {
            markdownFilesByNodeName.put(node.getName(), mdFile);
        }

        // This is the header row at the top of the page. The rest of the page is children of this node
        boolean doneWithChildren = processNodeExport(session, parentFolder, "", tn, true, level, true);

        String folder = req.getContentType().equals("fs") ? getFileNameFromNode(node) : node.getIdStr();

        if (!doneWithChildren && tn.children != null) {
            for (TreeNode c : tn.children) {
                boolean noExp = c.node.hasProp(NodeProp.NO_EXPORT.s());
                if (noExp) {
                    continue;
                }

                nodeStack.add(c.node);
                recurseNode(rootPath + "../", parentFolder + "/" + folder, c, nodeStack, level + 1, c.node.getIdStr());
                nodeStack.remove(c.node);
            }
        }

        if (hasFileProp && mdFile != null) {
            mdFile.title = getShortNodeText(mdFile.content.toString());

            if (req.isIncludeToc()) {
                // if we're at root level and have table of contents prepend it.
                if (mdFile.tocCount > 5) {
                    mdFile.content.insert(0, pathContent + mdFile.toc.toString() + "\n");
                } else {
                    mdFile.content.insert(0, pathContent);
                }
            }

            mdFiles.remove(mdFiles.size() - 1);
            mdFile = mdFiles.size() > 0 ? mdFiles.get(mdFiles.size() - 1) : null;
        }

        if (hasFolderProp) {
            mdPaths.remove(mdPaths.size() - 1);
        }
    }

    String concatAllChildren(TreeNode tn) {
        if (tn.children == null || tn.children.size() == 0) {
            return "";
        }

        StringBuilder sb = new StringBuilder();
        for (TreeNode c : tn.children) {
            sb.append("\n\n");
            sb.append(c.node.getContent());
        }
        return sb.toString();
    }

    boolean areAllChildrenAreSimpleLeafs(TreeNode tn) {
        if (tn.children == null)
            return true;
        for (TreeNode c : tn.children) {
            if (c.children != null && c.children.size() > 0
                    || (c.node.getAttachments() != null && c.node.getAttachments().size() > 0)) {
                return false;
            }
        }
        return true;
    }

    private String getFileNameFromNode(SubNode node) {
        String folder = getShortNodeText(node.getContent());
        if (StringUtils.isEmpty(folder)) {
            folder = node.getIdStr();
        }

        long ordinal = node.getOrdinal();
        // prefix folder with ordinal number left padded with zeroes to 5 digits
        folder = String.format("%05d", ordinal) + "_" + folder;
        return folder;
    }

    private String getShortNodeText(String content) {
        if (content == null)
            return "";
        content = content.trim();

        // rip off the first line if it's an xml comment
        int firstNLIdx = content.indexOf("\n");
        int endXmlCommentIdx = content.indexOf("-->\n");
        if (endXmlCommentIdx > 0 && firstNLIdx > 0 && endXmlCommentIdx < firstNLIdx) {
            content = content.substring(endXmlCommentIdx + 4);
        }

        String linkName = XString.truncAfterFirst(content, "\n");
        linkName = linkName.trim();
        linkName = XString.repeatingTrimFromFront(linkName, "#");
        linkName = linkName.trim();

        // For any characters in linkName that are not valid for a filename, replace them with a dash
        linkName = linkName.replaceAll("[^a-zA-Z0-9-_]", "-");

        // if linkName length is greater than 60, truncate it
        if (linkName.length() > 60) {
            linkName = linkName.substring(0, 60);

            // Now try to break at the last dash rather than chopping off in the middle of a word
            int lastDash = linkName.lastIndexOf("-");
            if (lastDash > 40) {
                linkName = linkName.substring(0, lastDash);
            }
        }

        linkName = XString.repeatingTrimFromEnd(linkName, "-");
        return linkName.trim();
    }

    private String buildMdPathContent() {
        StringBuilder sb = new StringBuilder();
        for (MarkdownFile mdFile : mdFiles) {
            if (sb.length() > 0)
                sb.append(" / ");

            // create file name that is sure to start with slash because they are always relative to root
            String fileName = mdFile.fileName;
            if (!fileName.startsWith("/"))
                fileName = "/" + fileName;

            sb.append("[" + getShortNodeText(mdFile.content.toString()) + "](" + fileName + ")");
        }

        // put a divider between the path content and the node content
        if (sb.length() > 0)
            return "**" + sb.toString() + "**\n\n";

        return "";
    }

    private String buildMdPaths() {
        StringBuilder sb = new StringBuilder();
        for (SubNode node : mdPaths) {
            sb.append("/");
            sb.append(node.getStr(NodeProp.FOLDER_NAME));
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
     * 
     * Returns true if the children were processed and no further drill down on the tree is needed
     */
    private boolean processNodeExport(MongoSession ms, String parentFolder, String deeperPath, TreeNode tn,
            boolean writeFile, int level, boolean isTopRow) {
        boolean ret = false;
        try {
            SubNode node = tn.node;
            String concatenatedChildren = "";
            if (req.getContentType().equals("fs")) {
                boolean allChildrenAreLeafs = areAllChildrenAreSimpleLeafs(tn);
                if (allChildrenAreLeafs) {
                    concatenatedChildren = concatAllChildren(tn);
                }
            }

            String content = node.getContent() != null ? node.getContent() : "";
            parseMarkdownLinks(content);
            content = content.trim();

            if (req.isUpdateHeadings()) {
                int lev = getHeadingLevel(node);
                boolean isFileNode = node.getStr(NodeProp.FILE_NAME) != null;
                content = edit.translateHeadingsForLevel(ms, content, lev, mdFile != null && isFileNode);
            }

            if (writeFile && req.isIncludeToc()) {
                addToTableOfContents(node, level, content);
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
                    handleAttachment(node, true, null, mdContent, deeperPath, targetFolder, writeFile, att);
                }
            }

            if (req.getContentType().equals("html")) {
                htmlContent.setVal(formatContentToHtml(node, htmlContent.getVal()));
                // special handling for htmlContent we have to do this File Tag injection AFTER the html escaping
                // and processing that's done in the line above
                if (atts != null) {
                    for (Attachment att : atts) {
                        // Process File Tag type attachments here first
                        if (!"ft".equals(att.getPosition())) {
                            continue;
                        }
                        handleAttachment(node, true, htmlContent, null, deeperPath, targetFolder, writeFile, att);
                    }
                }
                fullHtml.append(htmlContent.getVal());
            }

            if (req.getContentType().equals("md")) {
                // if appending to specific named markdown file
                if (mdFile != null) {
                    if (mdFile.content.length() > 0)
                        mdFile.content.append("\n");
                    if (req.isIncludeMetaComments()) {
                        mdFile.content.append(buildMarkdownHeader(node));
                    }
                    mdFile.content.append(mdContent.getVal() + "\n");
                }
            }

            if (atts != null) {
                for (Attachment att : atts) {
                    // Skip File Tag type attachments because they'll already have been processed above
                    if ("ft".equals(att.getPosition())) {
                        continue;
                    }
                    handleAttachment(node, false, null, null, deeperPath, targetFolder, writeFile, att);
                }
            }

            if (req.getContentType().equals("html")) {
                fullHtml.append("</div>\n");
            }
            if (writeFile) {
                if (concatenatedChildren.length() > 0) {
                    content += concatenatedChildren;
                    ret = true; // indicates to calling method we're done drilling down
                }
                writeFilesForNode(ms, parentFolder, node, content, atts);
            }
        } catch (Exception ex) {
            throw ExUtil.wrapEx(ex);
        }
        return ret;
    }

    private String buildMarkdownHeader(SubNode node) {
        StringBuilder sb = new StringBuilder();
        sb.append("<!-- id:" + node.getIdStr());
        if (StringUtils.isNoneEmpty(node.getName())) {
            sb.append(" name:" + node.getName());
        }
        sb.append(" -->\n");
        return sb.toString();
    }

    private void addToTableOfContents(SubNode node, int level, String content) {
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
                if (!XString.isValidMarkdownHeading(heading)) {
                    problems.append("bad markdown heading: " + heading + "\n");
                }
                String linkHeading = heading.replace(" ", "-").toLowerCase();
                level--;

                if (mdFile != null) {
                    int lev = getHeadingLevel(node);
                    String prefix = lev > 0 ? "    ".repeat(lev) : "";
                    mdFile.toc.append(prefix + "* [" + heading + "](#" + linkHeading + ")\n");
                    if (useMasterToc) {
                        mdFile.mtoc
                                .append(prefix + "* [" + heading + "](" + mdFile.fileName + "#" + linkHeading + ")\n");
                    }
                    mdFile.tocCount++;
                }

                String clazz = level == 0 ? "class='topLevelToc'" : "";
                htmlToc.append(
                        "<div " + clazz + " style='margin-left: " + (25 + level * 25) + "px'><a class='tocLink' href='#"
                                + node.getIdStr() + "'>" + StringEscapeUtils.escapeHtml4(heading) + "</a></div>");
            }
        }
    }

    private int getHeadingLevel(SubNode node) {
        int slashCount = StringUtils.countMatches(node.getPath(), "/");
        int lev = slashCount - (mdFile != null ? mdFile.baseSlashCount : baseSlashCount);
        if (lev > 6)
            lev = 6;
        return lev;
    }

    private void writeFilesForNode(MongoSession ms, String parentFolder, SubNode node, String content,
            List<Attachment> atts) {
        String fileName = getFileNameFromNode(node);
        String json = getNodeJson(node);

        if (req.getContentType().equals("fs")) {
            String mdFileName = parentFolder + "/" + fileName + "/content.md";
            addFileEntry(mdFileName, content.getBytes(StandardCharsets.UTF_8));
        } //
        else if (req.getContentType().equals("json")) {
            String id = node.getIdStr();
            String fullFileName = parentFolder + "/" + id + "/" + id + ".json";
            addFileEntry(fullFileName, json.getBytes(StandardCharsets.UTF_8));
        }
        if (atts != null) {
            for (Attachment att : atts) {
                writeAttachmentFileForNode(ms, parentFolder, node, fileName, att);
            }
        }
    }

    private String getNodeJson(SubNode node) {
        String json;
        // Pretty print the node having the relative path, and then restore the node to the full path
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
        if (att.getMime() == null)
            return;
        String ext = null;
        String attFileName = null;

        // if we want a friendly looking filename, with extension
        if (req.getContentType().equals("fs")) {
            attFileName = getAttachmentFileName(att, node);
            ext = FilenameUtils.getExtension(attFileName);
            if (!StringUtils.isEmpty(ext)) {
                ext = "." + ext;
            } else {
                ext = MimeTypeUtils.getExtensionFromMimeType(att.getMime());
                attFileName += ext;
            }
        }
        // else we just need it to be the key
        else {
            attFileName = att.getKey();
        }

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
                    throw new RuntimeException("Attachment " + attFileName + " is used twice in the same node");
                }

                String attFolder = fileUtil.getParentPath(mdFile.fileName);
                binFileName = attFolder + "/attachments/" + attFileName;
            } else {
                String folder = req.getContentType().equals("fs") ? fileName : node.getIdStr();
                binFileName = req.isAttOneFolder() ? ("/attachments/" + folder + "-" + att.getKey() + ext)
                        : (parentFolder + "/" + folder + "/" + attFileName);
            }

            if (length > 0) {
                // NOTE: the archive WILL fail if no length exists in this codepath
                addFileEntry(binFileName, bis, length);
            } else {
                /*
                 * This *should* never happen that we fall back to writing as an array from the input stream because
                 * normally we will always have the length saved on the node. But are trying to be as resilient as
                 * possible here falling back to this rather than failing the entire export
                 */
                addFileEntry(binFileName, IOUtils.toByteArray(bis));
            }
        } catch (Exception e) {
            throw ExUtil.wrapEx(e);
        } finally {
            StreamUtil.close(is);
        }
    }

    /*
     * If 'content' is passes as non-null then the ONLY thing we do is inject any File Tags onto that
     * content and return the content
     */
    private void handleAttachment(SubNode node, boolean injectingTag, Val<String> htmlContent, Val<String> mdContent,
            String deeperPath, String parentFolder, boolean writeFile, Attachment att) {
        String ext = null;
        String nodeId = node.getIdStr();
        String attFileName = getAttachmentFileName(att, node);

        ext = FilenameUtils.getExtension(attFileName);
        if (!StringUtils.isEmpty(ext)) {
            ext = "." + ext;
        } else {
            ext = MimeTypeUtils.getExtensionFromMimeType(att.getMime());
        }

        String displayName = att.getFileName() != null ? att.getFileName() : attFileName;
        String mimeType = att.getMime();
        String fullUrl = null;

        if (mdFile != null) {
            fullUrl = "attachments/" + attFileName;
        } else {
            fullUrl = parentFolder + "/" + nodeId + (req.isAttOneFolder() ? "-" : "/") + att.getKey() + ext;
        }

        String relPath = writeFile ? "" : (nodeId + "/");
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
            if (req.getContentType().equals("html")) {
                String htmlLink = appendImgLink(nodeId, displayName, fullUrl);
                processHtmlAtt(injectingTag, htmlContent, att, htmlLink);
            }
            if (req.getContentType().equals("md")) {
                String mdLink = null;
                if (att.getCssSize() != null && (att.getCssSize().endsWith("%") || att.getCssSize().endsWith("px"))) {
                    mdLink = "\n<img src='" + fullUrl + "' style='width:" + att.getCssSize() + "'/>\n\n";
                } else {
                    mdLink = "\n![" + displayName + "](" + fullUrl + ")\n\n";
                }
                processMdAtt(injectingTag, mdContent, att, mdLink);
            }
        } else {
            if (req.getContentType().equals("html")) {
                String htmlLink = appendNonImgLink(displayName, fullUrl);
                processHtmlAtt(injectingTag, htmlContent, att, htmlLink);
            }
            if (req.getContentType().equals("md")) {
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
            if (req.getContentType().equals("md")) {
                if (mdFile != null) {
                    mdFile.content.append(mdLink);
                }
            }
        }
    }

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
        // If we have duplicated a filename, number it sequentially to create a unique file
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
        // If we have duplicated a filename, number it sequentially to create a unique file
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
