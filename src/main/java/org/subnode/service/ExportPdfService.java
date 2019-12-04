package org.subnode.service;

//I have this entire file disabled because 1) this code never worked (yet), and 2) i decided to also just remove the
//pom.xml dependency for pdfbox also until it's working. WARNING: Also beware the PDF dependency has a log4j dependency in it
//which might conflict, and need to be 'excluded' from the dependency tree
 
// import java.io.BufferedOutputStream;
// import java.io.File;
// import java.nio.charset.StandardCharsets;

// import org.apache.pdfbox.pdmodel.PDDocument;
// import org.apache.pdfbox.pdmodel.PDPage;
// import org.apache.pdfbox.pdmodel.PDPageContentStream;
// import org.apache.pdfbox.pdmodel.font.PDFont;
// import org.apache.pdfbox.pdmodel.font.PDType1Font;
// import org.slf4j.Logger;
// import org.slf4j.LoggerFactory;
// import org.springframework.beans.factory.annotation.Autowired;
// import org.springframework.context.annotation.Scope;
// import org.springframework.stereotype.Component;

// import org.subnode.config.AppProp;
// import org.subnode.config.NodeProp;
// import org.subnode.config.SessionContext;
// import org.subnode.model.ExportPropertyInfo;
// import org.subnode.model.UserPreferences;
// import org.subnode.mongo.MongoApi;
// import org.subnode.mongo.MongoSession;
// import org.subnode.mongo.model.SubNode;
// import org.subnode.request.ExportRequest;
// import org.subnode.response.ExportResponse;
// import org.subnode.util.ExUtil;
// import org.subnode.util.FileTools;
// import org.subnode.util.SubNodeUtil;
// import org.subnode.util.ThreadLocals;

/* This file was taken from ExportTxtService (copied) and was about to be converted to PDF exporter
 * but i discovered the PDF api error shown below in which PDFBOX api freezes/hangs the thread whenver
 * any font is attempted to be created.
 */
// @Component
// @Scope("prototype")
public class ExportPdfService {
	// private static final Logger log = LoggerFactory.getLogger(ExportPdfService.class);

	// @Autowired
	// private MongoApi api;

	// @Autowired
	// private SubNodeUtil util;

	// @Autowired
	// private AppProp appProp;

	// @Autowired
	// private SessionContext sessionContext;

	// private MongoSession session;

	// private BufferedOutputStream output = null;
	// private String shortFileName;
	// private String fullFileName;

	// private static final byte[] NL = "\n".getBytes(StandardCharsets.UTF_8);

	// private ExportResponse res;

	// /*
	//  * Exports the node specified in the req. If the node specified is "/", or the repository root,
	//  * then we don't expect a filename, because we will generate a timestamped one.
	//  */
	// public void export(MongoSession session, ExportRequest req, ExportResponse res) {
	// 	if (session == null) {
	// 		session = ThreadLocals.getMongoSession();
	// 	}
	// 	this.res = res;
	// 	this.session = session;

	// 	UserPreferences userPreferences = sessionContext.getUserPreferences();
	// 	boolean exportAllowed = userPreferences != null ? userPreferences.isExportAllowed() : false;
	// 	if (!exportAllowed && !sessionContext.isAdmin()) {
	// 		throw ExUtil.newEx("You are not authorized to export.");
	// 	}

	// 	String nodeId = req.getNodeId();

	// 	if (!FileTools.dirExists(appProp.getAdminDataFolder())) {
	// 		throw ExUtil.newEx("adminDataFolder does not exist");
	// 	}

	// 	if (nodeId.equals("/")) {
	// 		throw ExUtil.newEx("Exporting entire repository is not supported.");
	// 	}
	// 	else {
	// 		log.info("Exporting to Text File");
	// 		exportNodeToFile(session, nodeId);
	// 		res.setFileName(shortFileName);
	// 	}

	// 	res.setSuccess(true);
	// }

	// private void exportNodeToFile(MongoSession session, String nodeId) {
	// 	if (!FileTools.dirExists(appProp.getAdminDataFolder())) {
	// 		throw ExUtil.newEx("adminDataFolder does not exist.");
	// 	}

	// 	shortFileName = "f" + util.getGUID() + ".md";
	// 	fullFileName = appProp.getAdminDataFolder() + File.separator + shortFileName;

	// 	SubNode exportNode = api.getNode(session, nodeId, true);
	// 	try {
	// 		log.debug("Export Node: " + exportNode.getPath() + " to file " + fullFileName);
	// 		//output = new BufferedOutputStream(new FileOutputStream(fullFileName));
			
	// 		///////////////////////
	// 		// Create a document and add a page to it
	// 		PDDocument document = new PDDocument();
	// 		PDPage page = new PDPage();
	// 		document.addPage(page);

	// 		// Create a new font object selecting one of the PDF base fonts
	// 		//********************************************************************************
	// 		//********************************************************************************
	// 		//********************************************************************************
	// 		//********************************************************************************			
	// 		//
	// 		// This line of code FREEZES in ALL versions of PdfBox, so pdf box is completely unusable
	// 		// at this point. I it may be my OS, or Java version, or whatever, but for now I cannot
	// 		// do any development around PDFBox because of this, and am putting all PDF work on hold
	// 		// pending new information.
	// 		//
	// 		PDFont font = PDType1Font.HELVETICA; 
	// 		//********************************************************************************
	// 		//********************************************************************************
	// 		//********************************************************************************
	// 		//********************************************************************************

	// 		// Start a new content stream which will "hold" the to be created content
	// 		PDPageContentStream contentStream = new PDPageContentStream(document, page);

	// 		// Define a text content stream using the selected font, moving the cursor and drawing
	// 		// the text "Hello World"
	// 		contentStream.beginText();
	// 		contentStream.setFont(font, 12);
	// 		contentStream.newLineAtOffset(100, 700);
	// 		contentStream.showText("Hello World. Clay's new PDF is awesome.");
	// 		contentStream.endText();

	// 		// Make sure that the content stream is closed:
	// 		contentStream.close();

	// 		// Save the results and ensure that the document is properly closed:
	// 		document.save(fullFileName);
	// 		document.close();
	// 		///////////////////////

	// 		// recurseNode(exportNode, 0);
	// 		// output.flush();
	// 	}
	// 	catch (Exception ex) {
	// 		throw ExUtil.newEx(ex);
	// 	}
	// 	finally {
	// 		//StreamUtil.close(output);
	// 		(new File(fullFileName)).deleteOnExit();
	// 	}
	// }

	// private void recurseNode(SubNode node, int level) {
	// 	if (node == null) return;

	// 	/* process the current node */
	// 	processNode(node);

	// 	for (SubNode n : api.getChildren(session, node, true, null)) {
	// 		recurseNode(n, level + 1);
	// 	}
	// }

	// private void processNode(SubNode node) {
	// 	try {
	// 		if (node.getProperties() != null) {
	// 			node.getProperties().forEach((propName, propVal) -> {
	// 				// log.debug(" PROP: "+propName);

	// 				if (propName.equals(NodeProp.BIN_FILENAME)) {
	// 				}

	// 				if (propName.equals(NodeProp.CONTENT)) {
	// 					print(propVal.getValue().toString());
	// 				}
	// 				else if (propName.equals(NodeProp.BIN_VER)) {
	// 				}
	// 				else {
	// 					ExportPropertyInfo propInfo = new ExportPropertyInfo();
	// 					propInfo.setName(propName);
	// 					propInfo.setVal(propVal.getValue());

	// 				}
	// 			});
	// 		}
	// 		print("\n----");
	// 	}
	// 	catch (Exception ex) {
	// 		throw ExUtil.newEx(ex);
	// 	}
	// }

	// // private List<String> removeIgnoredProps(List<String> list) {
	// // return list.stream().filter(item -> !ignoreProperty(item)).collect(Collectors.toList());
	// // }
	// //
	// // private boolean displayProperty(String propName) {
	// // if (NodeProp.CONTENT.equals(propName)) {
	// // return true;
	// // }
	// // return false;
	// // }

	// /*
	//  * todo-2: For verification of import/export we need to ignore these, but for DB replication in
	//  * P2P we wouldn't. need to store these values in a HASH for fast lookup
	//  */
	// // private boolean ignoreProperty(String propName) {
	// // return JcrProp.CREATED.equals(propName) || //
	// // JcrProp.LAST_MODIFIED.equals(propName) || //
	// // JcrProp.CREATED_BY.equals(propName) || //
	// // JcrProp.UUID.equals(propName) || //
	// // JcrProp.MERKLE_HASH.equals(propName) || //
	// // JcrProp.BIN_VER.equals(propName);
	// // }

	// // private void writeProperty(Property prop) {
	// // try {
	// // /* multivalue */
	// // if (prop.isMultiple()) {
	// // print(prop.getName() + ":");
	// // for (Value v : prop.getValues()) {
	// // print("* " + v.getString());
	// // }
	// // }
	// // /* else single value */
	// // else {
	// // if (prop.getName().equals(JcrProp.BIN_DATA)) {
	// // // writing a text file, so we ignore binaries...
	// // }
	// // else {
	// // // print(prop.getName() + ":");
	// // print(prop.getValue().getString());
	// // }
	// // }
	// // }
	// // catch (Exception ex) {
	// // throw ExUtil.newEx(ex);
	// // }
	// // }

	// private void print(String val) {
	// 	try {
	// 		output.write(val.getBytes(StandardCharsets.UTF_8));
	// 		if (!val.endsWith("\n")) {
	// 			output.write(NL);
	// 		}
	// 	}
	// 	catch (Exception ex) {
	// 		throw ExUtil.newEx(ex);
	// 	}
	// }
}
