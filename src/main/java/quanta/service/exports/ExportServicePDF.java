package quanta.service.exports;

import java.io.File;
import java.io.FileOutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;
import com.vladsch.flexmark.pdf.converter.PdfConverterExtension;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.TreeNode;
import quanta.model.client.Attachment;
import quanta.model.client.NodeProp;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;
import quanta.rest.request.ExportRequest;
import quanta.rest.response.ExportResponse;
import quanta.service.AppController;
import quanta.types.TypeBase;
import quanta.util.FileUtils;
import quanta.util.ImageUtil;
import quanta.util.StreamUtil;
import quanta.util.TL;
import quanta.util.XString;

/**
 * https://github.com/vsch/flexmark-java
 */
@Component
@Scope("prototype")
public class ExportServicePDF extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(ExportServicePDF.class);
    private String shortFileName;
    private String fullFileName;
    private StringBuilder markdown = new StringBuilder();
    private ExportRequest req;
    private int baseSlashCount = 0;

    /*
     * Exports the node specified in the req. If the node specified is "/", or the repository root, then
     * we don't expect a filename, because we will generate a timestamped one.
     */
    public void export(ExportRequest req, ExportResponse res) {
        this.req = req;

        String nodeId = req.getNodeId();
        if (!FileUtils.dirExists(svc_prop.getAdminDataFolder())) {
            throw new RuntimeEx("adminDataFolder does not exist");
        }
        if (nodeId.equals("/")) {
            throw new RuntimeEx("Exporting entire repository is not supported.");
        } else {
            log.info("Exporting to Text File");
            exportNodeToFile(nodeId);
            res.setFileName(shortFileName);
        }
    }

    private void exportNodeToFile(String nodeId) {
        if (!FileUtils.dirExists(svc_prop.getAdminDataFolder())) {
            throw new RuntimeEx("adminDataFolder does not exist.");
        }

        TreeNode rootNode = req.isThreadAsPDF() ? svc_mongoRead.getThreadGraphTree(nodeId) : //
                svc_mongoRead.getSubGraphTree(nodeId, null, null, null);

        SubNode exportNode = rootNode.node;
        String fileName = svc_snUtil.getExportFileName(req.getFileName(), exportNode);
        shortFileName = fileName + ".pdf";
        fullFileName = svc_prop.getAdminDataFolder() + File.separator + shortFileName;
        boolean wroteFile = false;
        if (req.isUpdateHeadings()) {
            baseSlashCount = StringUtils.countMatches(exportNode.getPath(), "/");
        }
        FileOutputStream out = null;
        try {
            /*
             * if this is the node being exported. PDF generator uses this special '[TOC]' (via TocExtension) as
             * the place where we want the table of contents injected so we can click the "Table of Contents"
             * checkbox in the export, or theoretically we could also insert this [TOC] somewhere else in the
             * text.
             */
            recurseNode(rootNode, 0);
            FlexmarkRender flexmarkRender = new FlexmarkRender();
            String body = flexmarkRender.markdownToHtml(markdown.toString());
            String html = generateHtml(body);

            out = new FileOutputStream(new File(fullFileName));
            PdfConverterExtension.exportToPdf(out, html, "", flexmarkRender.options);
            wroteFile = true;
            StreamUtil.close(out);

        } catch (Exception ex) {
            throw new RuntimeEx(ex);
        } finally {
            StreamUtil.close(out);
            if (wroteFile) {
                (new File(fullFileName)).deleteOnExit();
            }
        }
    }

    private void recurseNode(TreeNode tn, int level) {
        if (tn.node == null)
            return;
        processNode(tn.node);

        if (level == 0 && req.isIncludeToc()) {
            markdown.append("[TOC]");
        }

        if (tn.children != null) {
            for (TreeNode c : tn.children) {
                // If a node has a property "sn:noexport" (added by power users) then this node will not be
                // exported.
                String noExport = c.node.getStr(NodeProp.NO_EXPORT);
                if (noExport != null) {
                    continue;
                }
                recurseNode(c, level + 1);
            }
        }
    }

    private void processNode(SubNode node) {
        String nodeMarkdown = req.isDividerLine() ? "\n----\n" : "\n";

        String id = req.isIncludeIDs() ? (" (id:" + node.getIdStr() + ")") : "";
        if (req.isIncludeOwners()) {
            AccountNode accntNode = svc_user.getAccountNode(node.getOwner());
            if (accntNode != null) {
                nodeMarkdown += "Owner: " + accntNode.getStr(NodeProp.USER) + id + "\n";
            }
        } else {
            if (req.isIncludeIDs())
                nodeMarkdown += id + "\n";
        }
        nodeMarkdown += "\n";

        String content = node.getContent();
        TypeBase plugin = svc_typeMgr.getPluginByType(node.getType());
        if (plugin != null) {
            content = plugin.formatExportText("pdf", node);
        }

        if (content != null && req.isUpdateHeadings()) {
            content = content.trim();
            int slashCount = StringUtils.countMatches(node.getPath(), "/");
            int lev = slashCount - baseSlashCount; // top level node comes here with lev=0
            if (lev > 6)
                lev = 6;
            content = svc_edit.translateHeadingsForLevel(content, lev);
        }

        content = insertPropertySubstitutions(content, node);
        nodeMarkdown += content + "\n";
        nodeMarkdown = writeImages(node, nodeMarkdown);
        markdown.append(nodeMarkdown);
    }

    private String insertPropertySubstitutions(String content, SubNode node) {
        HashMap<String, Object> propMap = node.getProps();
        if (propMap != null && propMap.keySet() != null) {
            for (String propName : propMap.keySet()) {
                Object val = propMap.get(propName);
                if (val instanceof String sval) {
                    content = content.replace("{{" + propName + "}}", sval);
                }
            }
        }
        return content;
    }

    private String writeImages(SubNode node, String content) {
        List<Attachment> atts = node.getOrderedAttachments();
        if (atts == null)
            return content;

        // process all attachments specifically to embed the image ones
        for (Attachment att : atts) {
            // Since GIFs are really only ever used for animated GIFs nowadays, and since PDF files cannot
            // render them we just always ignore GIF files when generating PDFs.
            if (att.getFileName() != null && att.getFileName().toLowerCase().endsWith(".gif")) {
                continue;
            }

            if (att.getMime() != null && att.getMime().toLowerCase().endsWith("/gif")) {
                continue;
            }

            String mime = att.getMime();
            if (!ImageUtil.isImageMime(mime))
                continue;
            String bin = att.getBin();
            String url = att.getUrl();
            if (bin == null && url == null) {
                continue;
            }
            String style = "";
            String imgSize = att.getCssSize();

            if (imgSize != null && (imgSize.endsWith("%") || imgSize.endsWith("px"))) {
                style = " style='width:" + imgSize + "'";
            } else {
                // For large enough images if they're left to actual size that can clip in the final PDF output
                // so we set any images big enough that we know they're not a thubnail or icon depiction to 100%
                // always
                if (att.getWidth() > 500) {
                    style = " style='width:100%'";
                }
            }

            String src = null;
            if (bin != null) {
                String path = AppController.API_PATH + "/bin/" + bin + "?nodeId=" + node.getIdStr() + "&token="
                        + URLEncoder.encode(TL.getSC().getUserToken(), StandardCharsets.UTF_8);
                src = svc_prop.getProtocolHostAndPort() + path;
            } //
            else if (url != null) {
                src = url;
            }
            if (src == null)
                continue;

            String imgHtml = "\n<img src='" + src + "' " + style + "/>\n";

            if ("ft".equals(att.getPosition())) {
                content = content.replace("{{" + att.getFileName() + "}}", imgHtml);
            } else {
                /*
                 * I'm not wrapping this img in a div, so they don't get forced into a vertical display of images,
                 * but the PDF engine seems to be able to smartly insert images in an attractive way arranging small
                 * images side-by-side when they'll fit on the page so I'm just letting the PDF determine how to
                 * position images, since it seems ok
                 */
                content += imgHtml;
            }
        }
        return content;
    }

    /**
     * Wraps the generated content (html body part) into a larger complete HTML file
     */
    private String generateHtml(String body) {
        String ret = XString.getResourceAsString(context, "/public/export-includes/pdf/html-template.html");
        ret = ret.replace("{{hostAndPort}}", svc_prop.getHostAndPort());
        ret = ret.replace("{{body}}", body);
        return ret;
    }
}

////////////////////////////////////////////////////////////////
// DO NOT DELETE
//
// This is the code to do export to DOCX (MS Word) files but
// according to LibreOffice the file it generates is invalid, so
// I'm mothballing the code in this comment block for future reference
//
// I never looked deep into this however:
// https://github.com/vsch/flexmark-java/blob/c0313d67e0146292a10d04eb8944faff991579e9/flexmark-docx-converter/src/test/java/com/vladsch/flexmark/docx/converter/ComboDocxConverterSpecTestBase.java#L58
////////////////////////////////////////////////////////////////
//
// <dependency>
// <groupId>com.vladsch.flexmark</groupId>
// <artifactId>flexmark-docx-converter</artifactId>
// <version>0.62.2</version>
// </dependency>
// <dependency>
// <groupId>org.docx4j</groupId>
// <artifactId>docx4j-JAXB-ReferenceImpl</artifactId>
// <version>8.1.0</version>
// </dependency>
// MutableDataSet options =
// new MutableDataSet()
// .set(Parser.EXTENSIONS, Arrays.asList(
// // DefinitionExtension.create(),
// // EmojiExtension.create(),
// // FootnoteExtension.create(),
// // StrikethroughSubscriptExtension.create(),
// // InsExtension.create(),
// // SuperscriptExtension.create(),
// TablesExtension.create(),
// TocExtension.create()
// // SimTocExtension.create(),
// // WikiLinkExtension.create()
// ))
// .set(DocxRenderer.SUPPRESS_HTML, true)
// // the following two are needed to allow doc relative and site relative
// address resolution
// //.set(DocxRenderer.DOC_RELATIVE_URL, "") // this will be used for URLs like
// 'images/...' or './' or '../'
// //.set(DocxRenderer.DOC_ROOT_URL, "") // this will be used for URLs like:
// '/...'
// ;
// Parser PARSER = Parser.builder(options).build();
// DocxRenderer RENDERER = DocxRenderer.builder(options).build();
// recurseNode(exportNode, 0);
// Node document = PARSER.parse(markdown.toString());
// // to get XML
// String xml = RENDERER.render(document);
// // or to control the package
// WordprocessingMLPackage template = DocxRenderer.getDefaultTemplate();
// RENDERER.render(document, template);
// File file = new File(fullFileName);
// try {
// template.save(file);
// } catch (Docx4JException e) {
// e.printStackTrace();
// }
