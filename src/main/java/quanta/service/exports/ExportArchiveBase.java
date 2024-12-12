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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.query.Criteria;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.TreeNode;
import quanta.model.client.Attachment;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.mongo.model.SubNode;
import quanta.rest.request.ExportRequest;
import quanta.rest.response.ExportResponse;
import quanta.service.AclService;
import quanta.service.AppController;
import quanta.util.ExportUtil;
import quanta.util.FileUtils;
import quanta.util.MimeUtil;
import quanta.util.StreamUtil;
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

    private String contentType;
    private boolean includeToC;
    private boolean updateHeadings;
    private boolean includeIDs;
    private boolean dividerLine;
    private boolean includeMetaComments;
    private String targetFileName;
    private String baseFolder = "";

    /*
     * This will be true if we're publishing a node rather than doing an export. A published node is one
     * that will be available under "/pub/" url of web app.
     */
    private boolean publishing;

    int baseSlashCount = 0;

    // warnings and issues will be written to 'problems.txt' if there were any
    // issues with the export
    StringBuilder problems = new StringBuilder();

    // When publishing=true, this will hold the output HTML.
    private String html;
    private boolean numberedFigures = false;
    private String contentWidth = null;

    private class MarkdownLink {
        @SuppressWarnings("unused")
        String description;
        String link;

        MarkdownLink(String description, String link) {
            this.description = description;
            this.link = link;
        }
    }

    /*
     * It's possible that nodes recursively contained under a given node can have same name, so we have
     * to detect that and number them, so we use this hashset to detect existing filenames.
     */
    private final HashSet<String> fileNameSet = new HashSet<>();

    private String docTitle;
    private StringBuilder doc = new StringBuilder();
    private StringBuilder toc = new StringBuilder();

    // markdown links keyed by link url
    private HashMap<String, MarkdownLink> markdownLinks = new HashMap<>();
    private HashMap<String, TreeNode> treeItemsByNodeName = new HashMap<>();
    private int figNumStart = 1;

    private SubNode node;
    private SubNode parentSiteNode;

    public String generatePublication(SubNode parentSiteNode, String nodeId) {
        contentType = "html";
        includeToC = true;
        updateHeadings = true;
        includeIDs = false;
        dividerLine = false;
        includeMetaComments = false;
        targetFileName = null;
        publishing = true;
        baseFolder = "/export-includes/html/";
        this.parentSiteNode = parentSiteNode;
        export(nodeId);
        return html;
    }

    public void export(ExportRequest req, ExportResponse res) {
        contentType = req.getContentType();
        includeToC = req.isIncludeToc();
        updateHeadings = req.isUpdateHeadings();
        includeIDs = req.isIncludeIDs();
        dividerLine = req.isDividerLine();
        includeMetaComments = req.isIncludeMetaComments();
        targetFileName = req.getFileName();
        numberedFigures = req.isNumberedFigures();
        contentWidth = req.getContentWidth();
        publishing = false;

        // for markdown force updateHeadings and Attachments folder
        if (contentType.equals("md")) {
            updateHeadings = true;
        }
        String outputFile = export(req.getNodeId());
        res.setFileName(outputFile);
    }

    public String export(String nodeId) {
        if (publishing && !FileUtils.dirExists(svc_prop.getAdminDataFolder())) {
            throw new RuntimeEx("adminDataFolder does not exist: " + svc_prop.getAdminDataFolder());
        }

        Criteria criteria = null;
        if (publishing) {
            criteria = Criteria.where(SubNode.AC + "." + PrincipalName.PUBLIC.s()).ne(null);
        }

        TreeNode rootNode = svc_mongoRead.getSubGraphTree(nodeId, criteria, null, null);
        figNumStart = ExportUtil.prePocessTree(treeItemsByNodeName, figNumStart, rootNode);
        node = rootNode.node;
        baseSlashCount = StringUtils.countMatches(node.getPath(), "/");

        boolean success = false;
        try {
            if (!publishing) {
                String fileName = svc_snUtil.getExportFileName(targetFileName, node);
                shortFileName = fileName + "." + getFileExtension();
                fullFileName = svc_prop.getAdminDataFolder() + File.separator + shortFileName;
                openOutputStream(fullFileName);
            }

            rootPathParent = node.getParentPath();
            svc_auth.ownerAuth(node);
            ArrayList<SubNode> nodeStack = new ArrayList<>();
            nodeStack.add(node);

            if (publishing && parentSiteNode != null) {
                String parentSiteUrl = svc_snUtil.getFriendlyHtmlUrl(parentSiteNode);
                doc.append("[Parent Site](" + parentSiteUrl + ")\n\n");
            }

            // process the entire exported tree here
            recurseNode("../", "", rootNode, nodeStack, 0, null);
            writeMainFile();
            if (!publishing && problems.length() > 0) {
                addFileEntry("export-info.txt", problems.toString().getBytes(StandardCharsets.UTF_8));
            }

            success = true;
            return shortFileName;
        } catch (Exception ex) {
            throw new RuntimeEx(ex);
        } finally {
            closeOutputStream();
            if (!success && !publishing) {
                FileUtils.deleteFile(fullFileName);
            }
        }
    }

    private void writeMainFile() {
        switch (contentType) {
            case "md":
                writeMarkdownFile();
                break;
            case "html":
                writeHtmlFile();
                break;
            default:
                break;
        }
    }

    private void writeHtmlFile() {
        FlexmarkRender flexmarkRender = new FlexmarkRender();
        String tocIns = flexmarkRender.markdownToHtml(toc.toString());
        String bodyIns = flexmarkRender.markdownToHtml(doc.toString());
        html = generateHtml(tocIns, bodyIns);

        if (!publishing) {
            addFileEntry("index.html", html.toString().getBytes(StandardCharsets.UTF_8));
            addStaticFile("prism.css");
            addStaticFile("prism.js");
        }
    }

    private void addStaticFile(String fileName) {
        addFileEntry(fileName, XString.getResourceAsString(context, "/public/export-includes/html/" + fileName)
                .getBytes(StandardCharsets.UTF_8));
    }

    private String generateHtml(String toc, String body) {
        String templateFile = toc.length() > 0 ? "/public/export-includes/html/html-template-with-toc.html"
                : "/public/export-includes/html/html-template.html";
        String ret = XString.getResourceAsString(context, templateFile);

        String css = XString.getResourceAsString(context, "/public/export-includes/html/style.css");
        String contentWidthCss = null;
        if (StringUtils.isEmpty(contentWidth)) {
            contentWidthCss = "";
        } else {
            contentWidthCss = "width: " + contentWidth + ";\nmargin-left: auto;\nmargin-right: auto;\n";
        }

        ret = ret.replace("/*{{style}}*/", css);
        ret = ret.replace("/*{{contentWidth}}*/", contentWidthCss);

        ret = ret.replace("/*{{script}}*/",
                XString.getResourceAsString(context, "/public/export-includes/html/script.js"));
        if (toc.length() > 0) {
            ret = ret.replace("{{toc}}", toc);
        }
        if (docTitle != null) {
            ret = ret.replace("{{title}}", docTitle);
        }
        ret = ret.replace("{{baseFolder}}", baseFolder);
        ret = ret.replace("{{body}}", body);
        return ret;
    }

    @SuppressWarnings("rawtypes")
    private void writeMarkdownFile() {
        String content = doc.toString();
        // translate all the links to markdown compatable links
        if (content.contains("](")) {
            Iterator iter = markdownLinks.entrySet().iterator();
            while (iter.hasNext()) {
                Map.Entry entry = (Map.Entry) iter.next();
                MarkdownLink value = (MarkdownLink) entry.getValue();

                String renderLink = value.link;
                // if link.value starts with "/n/" then replace the "/n/" prefix with "#"
                if (value.link.startsWith("/n/")) {
                    renderLink = "#" + value.link.substring(3);
                }
                content = content.replace("](" + value.link + ")", "](" + renderLink + ")");
            }
        }

        if (includeToC) {
            content = toc.toString() + "\n\n" + content;
        }
        addFileEntry("index.md", content.getBytes(StandardCharsets.UTF_8));
    }

    private void recurseNode(String rootPath, String parentFolder, TreeNode tn, ArrayList<SubNode> nodeStack, int level,
            String parentId) {
        SubNode node = tn.node;
        if (node == null)
            return;
        boolean publishedSubSite = false;

        /* If we encounter a Website within a website then build it */
        if (level > 0 && publishing && node.getBool(NodeProp.WEBSITE)) {
            ExportTarService svc = (ExportTarService) context.getBean(ExportTarService.class);
            String html = svc.generatePublication(this.node, node.getIdStr());
            svc_publication.cachePut(node, html);
            publishedSubSite = true;
        }

        /*
         * When publishing, we only export nodes that are public. This is a redundant check because the
         * query criteria itself should have only pulled up public nodes, but we do this check here anyway.
         */
        if (publishing && !AclService.isPublic(node)) {
            return;
        }

        // If a node has a property "noexport" (added by power users) then this node
        // will not be exported.
        String noExport = node.getStr(NodeProp.NO_EXPORT);
        if (noExport != null) {
            return;
        }

        // This is the header row at the top of the page. The rest of the page is
        // children of this node
        boolean doneWithChildren = processNodeExport(parentFolder, "", tn, true, level, true, publishedSubSite);
        String folder = contentType.equals("fs") ? getFileNameFromNode(node) : node.getIdStr();

        if (!doneWithChildren && tn.children != null && !publishedSubSite) {
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

        // For any characters in linkName that are not valid for a filename, replace
        // them with a dash
        linkName = linkName.replaceAll("[^a-zA-Z0-9-_]", "-");

        // if linkName length is greater than 60, truncate it
        if (linkName.length() > 60) {
            linkName = linkName.substring(0, 60);

            // Now try to break at the last dash rather than chopping off in the middle of a
            // word
            int lastDash = linkName.lastIndexOf("-");
            if (lastDash > 40) {
                linkName = linkName.substring(0, lastDash);
            }
        }

        linkName = XString.repeatingTrimFromEnd(linkName, "-");
        return linkName.trim();
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
    private boolean processNodeExport(String parentFolder, String deeperPath, TreeNode tn, boolean writeFile, int level,
            boolean isTopRow, boolean publishedSubSite) {
        boolean ret = false;
        try {
            SubNode node = tn.node;
            String concatenatedChildren = "";
            if (contentType.equals("fs")) {
                boolean allChildrenAreLeafs = areAllChildrenAreSimpleLeafs(tn);
                if (allChildrenAreLeafs) {
                    concatenatedChildren = concatAllChildren(tn);
                }
            }

            String content = node.getContent() != null ? node.getContent() : "";
            parseMarkdownLinks(content);
            content = ExportUtil.injectFigureLinks(treeItemsByNodeName, content);
            content = content.trim();

            if (updateHeadings) {
                int lev = getHeadingLevel(node);
                content = svc_edit.translateHeadingsForLevel(content, lev - 1);
            }

            String title = getTitleFromContent(content);
            if (writeFile) {
                if (includeToC) {
                    addToTableOfContents(node, level, content, publishedSubSite);
                }
                if (docTitle == null) {
                    docTitle = title;
                }
            }

            List<Attachment> atts = node.getOrderedAttachments();
            String targetFolder = null;

            // if we have a markdown file, all the attachments go into that folder
            if (contentType.equals("md")) {
                targetFolder = "";
            } else {
                targetFolder = "." + parentFolder;
            }

            // Normally images go below content but if we have any attributes with position="ur" (upper right,
            // or left) then we need to insert those into the content first, and make float right.
            if (atts != null && contentType.equals("html")) {
                int figNum = tn.figNumStart;
                for (Attachment att : atts) {
                    if (svc_snUtil.hasBasicPositioning(att)) {
                        handleAttachment(node, false, null, deeperPath, targetFolder, writeFile, att, figNum);
                        figNum++;
                    }
                }
            }

            Val<String> contentVal = new Val<>(content);

            // Process all attachments just to insert File Tags into content
            if (atts != null) {
                int figNum = tn.figNumStart;
                for (Attachment att : atts) {
                    // detect case where we'll have already handle the image above
                    if (contentType.equals("html") && svc_snUtil.hasBasicPositioning(att)) {
                        continue;
                    }
                    // Process File Tag type attachments here first
                    if (!"ft".equals(att.getPosition())) {
                        continue;
                    }
                    handleAttachment(node, true, contentVal, deeperPath, targetFolder, writeFile, att, figNum);
                    figNum++;
                }
            }

            switch (contentType) {
                case "md":
                    removeSpecialSyntax(contentVal);
                    if (doc.length() > 0)
                        doc.append("\n");

                    if (includeMetaComments) {
                        doc.append(buildMarkdownHeader(node));
                    }

                    doc.append(contentVal.getVal());
                    doc.append("\n\n");
                    break;
                case "html":
                    removeSpecialSyntax(contentVal);
                    contentVal.setVal(formatContentForHtml(node, contentVal.getVal()));
                    // special handling for htmlContent we have to do this File Tag injection AFTER
                    // the html escaping and processing that's done in the line above
                    if (atts != null) {
                        int figNum = tn.figNumStart;
                        for (Attachment att : atts) {
                            // detect case where we'll have already handle the image above
                            if (contentType.equals("html") && svc_snUtil.hasBasicPositioning(att)) {
                                continue;
                            }

                            // Process File Tag type attachments here first
                            if (!"ft".equals(att.getPosition())) {
                                continue;
                            }
                            handleAttachment(node, true, contentVal, deeperPath, targetFolder, writeFile, att, figNum);
                            figNum++;
                        }
                    }

                    if (includeToC) {
                        doc.append("\n<div id='" + node.getIdStr() + "'></div>\n");
                    }

                    if (publishedSubSite) {
                        doc.append("\n\n" + title);
                        String nodeUrl = svc_snUtil.getFriendlyHtmlUrl(node);
                        doc.append("\n\n[Link to Content](" + nodeUrl + ")\n\n");
                    } else {
                        doc.append(contentVal.getVal());
                        doc.append("\n\n");
                    }
                    break;
                default:
                    break;
            }

            if (atts != null) {
                int figNum = tn.figNumStart;
                for (Attachment att : atts) {
                    // detect case where we'll have already handle the image above
                    if (contentType.equals("html") && svc_snUtil.hasBasicPositioning(att)) {
                        continue;
                    }

                    // Skip File Tag type attachments because they'll already have been processed
                    // above
                    if ("ft".equals(att.getPosition())) {
                        continue;
                    }
                    handleAttachment(node, false, null, deeperPath, targetFolder, writeFile, att, figNum);
                    figNum++;
                }
            }

            if (writeFile) {
                if (concatenatedChildren.length() > 0) {
                    content += concatenatedChildren;
                    ret = true; // indicates to calling method we're done drilling down
                }

                if (!publishing) {
                    writeFilesForNode(parentFolder, node, content, atts);
                }
            }
        } catch (Exception ex) {
            throw new RuntimeEx(ex);
        }
        return ret;
    }

    private String getTitleFromContent(String content) {
        String title = null;
        int newLineIdx = content.indexOf("\n");
        if (newLineIdx != -1) {
            title = content.substring(0, newLineIdx);
        } else {
            title = content;
        }
        // trim to max of 50 chars
        if (title.length() > 50) {
            title = title.substring(0, 50);
        }
        return title.trim();
    }

    // Tokenize contentVal into lines and remove any lines that are just a single
    // dash, but leave intact
    // any inside code blocks
    private void removeSpecialSyntax(Val<String> contentVal) {
        String[] lines = contentVal.getVal().split("\n");
        StringBuilder sb = new StringBuilder();
        boolean inCodeBlock = false;
        for (String line : lines) {
            if (line.startsWith("```")) {
                inCodeBlock = !inCodeBlock;
            }

            // Remove the "centering" markdown syntax
            if (line.contains("->") && line.contains("<-")) {
                String temp = line.trim();
                // if line starts with "->" and ends with "<-" then remove those substrings
                if (temp.startsWith("->") && temp.endsWith("<-")) {
                    line = temp.substring(2, temp.length() - 2);
                }
            }

            if (!line.equals("-") || inCodeBlock) {
                sb.append(line);
            }
            sb.append("\n");
        }
        contentVal.setVal(sb.toString().trim());
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

    private String extractHeadingText(String content) {
        if (content == null)
            return null;
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
                if ("md".equals(contentType) && !XString.isValidMarkdownHeading(heading)) {
                    problems.append("bad markdown heading: " + heading + "\n");
                }
                return heading;
            }
        }
        return null;
    }

    private void addToTableOfContents(SubNode node, int level, String content, boolean publishedSubSite) {
        if (includeToC) {
            String heading = extractHeadingText(content);
            if (heading == null)
                return;
            level--;
            int lev = getHeadingLevel(node) - 1;
            String prefix = lev > 0 ? "    ".repeat(lev) : "";
            String target = null;
            switch (contentType) {
                case "md":
                    target = "#" + heading.replace(" ", "-").toLowerCase();
                    break;
                case "html":
                    target = publishedSubSite ? svc_snUtil.getFriendlyHtmlUrl(node) : ("#" + node.getIdStr());
                    break;
                default:
                    break;
            }

            if (node.getIdStr().equals(this.node.getIdStr())) {
                toc.append("#### [" + heading + "](" + target + ")\n");
            } else {
                toc.append(prefix + "* [" + heading + "](" + target + ")\n");
            }
        }
    }

    private int getHeadingLevel(SubNode node) {
        int slashCount = StringUtils.countMatches(node.getPath(), "/");
        int lev = slashCount - baseSlashCount;
        if (lev > 6)
            lev = 6;
        return lev;
    }

    private void writeFilesForNode(String parentFolder, SubNode node, String content, List<Attachment> atts) {
        String fileName = getFileNameFromNode(node);
        String json = getNodeJson(node);
        String fullFileName = null;

        switch (contentType) {
            case "fs":
                fullFileName = parentFolder + "/" + fileName + "/content.md";
                addFileEntry(fullFileName, content.getBytes(StandardCharsets.UTF_8));
                break;
            case "json":
                String id = node.getIdStr();
                fullFileName = parentFolder + "/" + id + "/" + id + ".json";
                addFileEntry(fullFileName, json.getBytes(StandardCharsets.UTF_8));
                break;
            default:
                break;
        }

        if (atts != null) {
            for (Attachment att : atts) {
                writeAttachmentFileForNode(parentFolder, node, fileName, att);
            }
        }
    }

    private String getNodeJson(SubNode node) {
        String json;
        // Pretty print the node having the relative path, and then restore the node to
        // the full path
        String fullPath = node.getPath();
        String relPath = fullPath.substring(rootPathParent.length());
        try {
            node.directSetPath(relPath);
            json = svc_snUtil.toCanonicalJson(node);
        } finally {
            node.directSetPath(fullPath);
        }
        return json;
    }

    private String getAttachmentFileName(Attachment att, SubNode node) {
        String fileName = att.getFileName();

        // we have some possibility of fileName being an actual URL that it was
        // downloaded from so we don't
        // let those be used here and fall back to the key instead
        if (fileName == null || fileName.indexOf("/") != -1) {
            fileName = att.getKey();
        }

        // Some software chokes on spaces in filenames (like VSCode markdown preview),
        // so don't allow that.
        fileName = fileName.replace(" ", "_");
        return fileName;
    }

    private String getAttachmentFileNameEx(Attachment att, SubNode node) {
        String fileName = node.getIdStr() + "_" + att.getKey();
        String attFileName = att.getFileName();

        // try first to get the extension from the filename
        String ext = FilenameUtils.getExtension(attFileName);
        if (!StringUtils.isEmpty(ext)) {
            fileName += "." + ext;
        }
        // if no extension in the filename, try to get it from the mime type
        else {
            // NOTE: this method will retun with the "." in front of the extension
            ext = MimeUtil.getExtensionFromMimeType(att.getMime());
            fileName += ext;
        }
        return fileName;
    }

    private void writeAttachmentFileForNode(String parentFolder, SubNode node, String path, Attachment att) {
        if (att.getMime() == null)
            return;
        String ext = null;
        String attFileName = null;

        switch (contentType) {
            case "fs":
                attFileName = getAttachmentFileName(att, node);
                ext = FilenameUtils.getExtension(attFileName);
                if (!StringUtils.isEmpty(ext)) {
                    ext = "." + ext;
                } else {
                    ext = MimeUtil.getExtensionFromMimeType(att.getMime());
                    attFileName += ext;
                }
                break;
            case "json":
                attFileName = att.getKey();
                break;
            default:
                attFileName = getAttachmentFileNameEx(att, node);
                break;
        }

        InputStream is = null;
        try {
            is = svc_attach.getStream(att.getKey(), node);
            if (is == null)
                return;
            BufferedInputStream bis = new BufferedInputStream(is);
            long length = att != null ? att.getSize() : null;

            String binFileName = null;

            switch (contentType) {
                case "md":
                case "html":
                    binFileName = "/attachments/" + attFileName;
                    break;
                default:
                    String folder = contentType.equals("fs") ? path : node.getIdStr();
                    binFileName = parentFolder + "/" + folder + "/" + attFileName;
                    break;
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
            throw new RuntimeEx(e);
        } finally {
            StreamUtil.close(is);
        }
    }

    /*
     * If 'content' is passes as non-null then the ONLY thing we do is inject any File Tags onto that
     * content and return the content
     */
    private void handleAttachment(SubNode node, boolean injectingTag, Val<String> content, String deeperPath,
            String parentFolder, boolean writeFile, Attachment att, int figNum) {
        String nodeId = node.getIdStr();

        String af = getAttachmentFileName(att, node);
        String ext = FilenameUtils.getExtension(af);
        if (!StringUtils.isEmpty(ext)) {
            ext = "." + ext;
        } else {
            ext = MimeUtil.getExtensionFromMimeType(att.getMime());
        }
        String displayName = att.getFileName() != null ? att.getFileName() : af;
        String mimeType = att.getMime();
        String fullUrl = null;

        switch (contentType) {
            case "md":
            case "html":
                // if publishing on the website we build a path to the URL.
                if (publishing) {
                    String bin = att.getBin();
                    if (bin != null) {
                        String path = AppController.API_PATH + "/bin/" + bin + "?nodeId=" + node.getIdStr();
                        fullUrl = svc_prop.getProtocolHostAndPort() + path;
                    } else {
                        fullUrl = att.getUrl();
                    }
                }
                // else we point to the attachments folder
                else {
                    fullUrl = "attachments/" + getAttachmentFileNameEx(att, node);
                }
                break;
            default:
                break;
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
            switch (contentType) {
                case "html":
                case "md":
                    String mdLink = null;
                    String sizePart = "";
                    if (att.getCssSize() != null
                            && (att.getCssSize().endsWith("%") || att.getCssSize().endsWith("px"))) {
                        sizePart = "style='width:" + att.getCssSize() + "'";
                    }

                    String imgClass = "";
                    if ("ur".equals(att.getPosition())) {
                        imgClass = "class='img-upper-right'";
                    } else if ("ul".equals(att.getPosition())) {
                        imgClass = "class='img-upper-left'";
                    } else if ("c".equals(att.getPosition())) {
                        imgClass = "class='img-upper-center'";
                    }

                    // NOTE: This simple markdown works too but looses the styling
                    // mdLink = "\n![" + displayName + "](" + fullUrl + ")\n\n";
                    String domId = "img_" + nodeId + "_" + att.getKey();
                    mdLink = "<img id='%s' src='%s' %s %s/>\n\n".formatted(domId, fullUrl, sizePart, imgClass);

                    if (figNum > 0 && numberedFigures) {
                        mdLink = "<figure>\n" + mdLink + "<figcaption>Fig. " + figNum + "</figcaption>\n</figure>\n";
                    }

                    processMdAtt(injectingTag, content, att, mdLink);
                    break;
                default:
                    break;
            }
        } else {
            switch (contentType) {
                case "html":
                case "md":
                    String mdLink = "\n[" + displayName + "](" + fullUrl + ")\n";
                    processMdAtt(injectingTag, content, att, mdLink);
                    break;
                default:
                    break;
            }
        }
    }

    private void processMdAtt(boolean injectingTag, Val<String> content, Attachment att, String mdLink) {
        if (injectingTag) {
            if (content != null) {
                content.setVal(insertMdLink(content.getVal(), att, mdLink));
            }
        } else {
            if (contentType.equals("md") || contentType.equals("html")) {
                doc.append(mdLink);
            }
        }
    }

    private String insertMdLink(String content, Attachment att, String mdLink) {
        if ("ft".equals(att.getPosition())) {
            content = content.replace("{{" + att.getFileName() + "}}", mdLink);
        }
        return content;
    }

    private String formatContentForHtml(SubNode node, String content) {
        if (node.isType(NodeType.PLAIN_TEXT)) {
            return "\n```\n" + content + "\n```\n";
        } else {
            String prefix = "";
            if (dividerLine) {
                prefix += "\n----\n";
            }

            // If ToC is included the IDs will already be in a DIV tag as the ID, so we
            // don't need it here also.
            if (includeIDs && !includeToC) {
                prefix += "\n<!-- ID:" + node.getIdStr() + " -->\n";
            }
            return prefix + "\n" + content + "\n";
        }
    }

    private void addFileEntry(String fileName, byte[] bytes) {
        // If we have duplicated a filename, number it sequentially to create a unique
        // file
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
        // If we have duplicated a filename, number it sequentially to create a unique
        // file
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
            }
        }
    }

    public abstract String getFileExtension();

    public abstract void openOutputStream(String fileName);

    public abstract void closeOutputStream();

    public abstract void addEntry(String fileName, byte[] bytes);

    public abstract void addEntry(String fileName, InputStream stream, long length);
}
