package org.subnode.service;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Arrays;

import com.vladsch.flexmark.ext.tables.TablesExtension;
import com.vladsch.flexmark.ext.toc.TocExtension;
import com.vladsch.flexmark.ext.toc.internal.TocOptions;
import com.vladsch.flexmark.html.HtmlRenderer;
import com.vladsch.flexmark.parser.Parser;
import com.vladsch.flexmark.pdf.converter.PdfConverterExtension;
import com.vladsch.flexmark.util.ast.Node;
import com.vladsch.flexmark.util.data.MutableDataSet;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Scope;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.subnode.config.AppProp;
import org.subnode.config.ConstantsProvider;
import org.subnode.config.SessionContext;
import org.subnode.model.UserPreferences;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.ExportRequest;
import org.subnode.response.ExportResponse;
import org.subnode.util.ExUtil;
import org.subnode.util.FileUtils;
import org.subnode.util.StreamUtil;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;

// todo-0: export need to return the md5 hash back to the client so the client can put that in the url with ?v=cache

/**
 * https://github.com/vsch/flexmark-java
 */
@Component
@Scope("prototype")
public class ExportServiceFlexmark {
	private static final Logger log = LoggerFactory.getLogger(ExportServiceFlexmark.class);

	@Autowired
	private SubNodeUtil util;

	@Autowired
	private AppProp appProp;

	@Autowired
	private MongoRead read;

	@Autowired
	private ConstantsProvider constProvider;

	@Autowired
	private SessionContext sessionContext;

	private MongoSession session;

	private String shortFileName;
	private String fullFileName;

	private StringBuilder markdown = new StringBuilder();
	private String format;

	private ExportRequest req;

	/*
	 * Exports the node specified in the req. If the node specified is "/", or the
	 * repository root, then we don't expect a filename, because we will generate a
	 * timestamped one.
	 * 
	 * Format can be 'html' or 'pdf'
	 */
	public void export(MongoSession session, String format, ExportRequest req, ExportResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		this.session = session;
		this.format = format;
		this.req = req;

		UserPreferences userPreferences = sessionContext.getUserPreferences();
		boolean exportAllowed = userPreferences != null ? userPreferences.isExportAllowed() : false;
		if (!exportAllowed && !sessionContext.isAdmin()) {
			throw ExUtil.wrapEx("You are not authorized to export.");
		}

		String nodeId = req.getNodeId();

		if (!FileUtils.dirExists(appProp.getAdminDataFolder())) {
			throw ExUtil.wrapEx("adminDataFolder does not exist");
		}

		if (nodeId.equals("/")) {
			throw ExUtil.wrapEx("Exporting entire repository is not supported.");
		} else {
			log.info("Exporting to Text File");
			exportNodeToFile(session, nodeId);
			res.setFileName(shortFileName);
		}

		res.setSuccess(true);
	}

	private void exportNodeToFile(MongoSession session, String nodeId) {
		if (!FileUtils.dirExists(appProp.getAdminDataFolder())) {
			throw ExUtil.wrapEx("adminDataFolder does not exist.");
		}

		SubNode exportNode = read.getNode(session, nodeId, true);
		String fileName = util.getExportFileName(req.getFileName(), exportNode);
		shortFileName = fileName + "." + format;
		fullFileName = appProp.getAdminDataFolder() + File.separator + shortFileName;

		FileOutputStream out = null;
		try {
			// Let's keep these examples commented until I have time to understand them...
			//
			// MutableDataSet options = PegdownOptionsAdapter.flexmarkOptions(
			// Extensions.ALL & ~(Extensions.ANCHORLINKS | Extensions.EXTANCHORLINKS_WRAP)
			// , TocExtension.create()).toMutable()
			// .set(TocExtension.LIST_CLASS, PdfConverterExtension.DEFAULT_TOC_LIST_CLASS)
			// .toImmutable();
			/////////////////
			// options.set(Parser.EXTENSIONS, Arrays.asList(
			// TocExtension.create(),
			// AnchorLinkExtension.create()
			// ));
			// options.set(AnchorLinkExtension.ANCHORLINKS_WRAP_TEXT, false);

			// uncomment to convert soft-breaks to hard breaks
			// options.set(HtmlRenderer.SOFT_BREAK, "<br />\n");

			MutableDataSet options = new MutableDataSet();
			options.set(Parser.EXTENSIONS, Arrays.asList(TablesExtension.create(), TocExtension.create()));
			options.set(TocExtension.LEVELS, TocOptions.getLevels(1, 2, 3, 4, 5, 6));

			Parser parser = Parser.builder(options).build();
			HtmlRenderer renderer = HtmlRenderer.builder(options).build();

			recurseNode(exportNode, 0);

			Node document = parser.parse(markdown.toString());
			String body = renderer.render(document);

			String html = generateHtml(body);

			if ("html".equals(format)) {
				FileUtils.writeEntireFile(fullFileName, html);
			} else if ("pdf".equals(format)) {
				out = new FileOutputStream(new File(fullFileName));
				PdfConverterExtension.exportToPdf(out, html, "", options);
			} else {
				throw new RuntimeException("invalid format.");
			}

		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		} finally {
			StreamUtil.close(out);
			(new File(fullFileName)).deleteOnExit();
		}
	}

	private void recurseNode(SubNode node, int level) {
		if (node == null)
			return;

		processNode(node);
		Sort sort = Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL);

		for (SubNode n : read.getChildren(session, node, sort, null)) {
			recurseNode(n, level + 1);
		}
	}

	private void processNode(SubNode node) {
		String content = node.getContent();
		markdown.append("\n");
		markdown.append(content);
		markdown.append("\n");
		writeImage(node);
	}

	private void writeImage(SubNode node) {
		String bin = node.getStringProp(NodeProp.BIN.s());
		if (bin == null) {
			return;
		}

		String style = "";
		String imgSize = node.getStringProp(NodeProp.IMG_SIZE.s());
		if (imgSize != null && imgSize.endsWith("%") || imgSize.endsWith("px")) {
			style = " style='width:" + imgSize + "'";
		}

		markdown.append("\n<img src='" + constProvider.getHostAndPort() + "/mobile/api/bin/" + bin + "?nodeId="
				+ node.getId().toHexString() + "&token=" + sessionContext.getUserToken() + "' " + style + "/>\n");
	}

	/**
	 * Wraps the generated content (html body part) into a larger complete HTML file
	 */
	private String generateHtml(String body) {
		String ret = XString.getResourceAsString("/public/export-includes/flexmark/html-template.html");
		ret = ret.replace("{{hostAndPort}}", constProvider.getHostAndPort());
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
