package org.subnode.service;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;

import org.subnode.config.AppProp;
import org.subnode.model.client.NodeProp;
import org.subnode.config.SessionContext;
import org.subnode.model.UserPreferences;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.ExportRequest;
import org.subnode.response.ExportResponse;
import org.subnode.util.ExUtil;
import org.subnode.util.FileTools;
import org.subnode.util.FileUtils;
import org.subnode.util.StreamUtil;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.ValContainer;
import org.subnode.util.XString;

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringEscapeUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;

/**
 * Base class for exporting to archives. Two superclasses will exist:
 * 
 * 1) Zip Export
 * 
 * 2) TAR export
 */
public abstract class ExportArchiveBase {
	private static final Logger log = LoggerFactory.getLogger(ExportArchiveBase.class);

	@Autowired
	private MongoApi api;

	@Autowired
	private SubNodeUtil util;

	@Autowired
	private AttachmentService attachmentService;

	@Autowired
	private FileUtils fileUtils;

	private String shortFileName;
	private String fullFileName;

	/*
	 * It's possible that nodes recursively contained under a given node can have
	 * same name, so we have to detect that and number them, so we use this hashset
	 * to detect existing filenames.
	 */
	private HashSet<String> fileNameSet = new HashSet<String>();

	@Autowired
	private AppProp appProp;

	@Autowired
	private SessionContext sessionContext;

	private MongoSession session;

	public void export(MongoSession session, ExportRequest req, ExportResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		this.session = session;

		UserPreferences userPreferences = sessionContext.getUserPreferences();
		boolean exportAllowed = userPreferences != null ? userPreferences.isExportAllowed() : false;
		if (!exportAllowed && !sessionContext.isAdmin()) {
			throw ExUtil.newEx("You are not authorized to export.");
		}

		if (!FileTools.dirExists(appProp.getAdminDataFolder())) {
			throw ExUtil.newEx("adminDataFolder does not exist: " + appProp.getAdminDataFolder());
		}

		String nodeId = req.getNodeId();

		shortFileName = "f" + util.getGUID() + "." + getFileExtension();
		fullFileName = appProp.getAdminDataFolder() + File.separator + shortFileName;

		boolean success = false;
		try {
			openOutputStream(fullFileName);

			SubNode node = api.getNode(session, nodeId);
			api.authRequireOwnerOfNode(session, node);
			recurseNode("", node, 0, null);
			res.setFileName(shortFileName);
			success = true;
		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		} finally {
			closeOutputStream();

			if (!success) {
				FileTools.deleteFile(fullFileName);
			}
		}

		res.setSuccess(true);
	}

	public abstract String getFileExtension();

	public abstract void openOutputStream(String fileName);

	public abstract void closeOutputStream();

	public abstract void addEntry(String fileName, byte[] bytes);

	private void recurseNode(String parentFolder, SubNode node, int level, String parentHtmlFile) {
		if (node == null)
			return;

		log.debug("recurseNode: " + node.getContent() + " parentHtmlFile=" + parentHtmlFile);

		StringBuilder html = new StringBuilder();
		html.append("<html><body>");

		if (parentHtmlFile != null) {
			html.append("<a href='" + parentHtmlFile + "'><button>Up Level</button></a><br style='height:20px;'>");
		}

		/* process the current node */
		ValContainer<String> fileName = new ValContainer<String>();

		Iterable<SubNode> iter = api.getChildren(session, node, Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL),
				null);
		List<SubNode> children = api.iterateToList(iter);

		String folder = processNodeExport(parentFolder, node, html, true, fileName);

		if (children != null) {
			int childCount = 0;

			/*
			 * First pass over children is to embed their content onto the child display on
			 * the current page
			 */
			for (SubNode n : children) {
				if (childCount == 0) {
					html.append("<hr style='height:10px; background-color: lightGray;'/>");
				} else {
					html.append("<hr style='height:3px; background-color: lightGray;'/>");
				}
				processNodeExport(parentFolder, n, html, false, null);
				childCount++;
			}
		}

		html.append("</body></html>");
		String htmlFile = fileName.getVal() + ".html";
		addFileEntry(htmlFile, html.toString().getBytes(StandardCharsets.UTF_8));

		String relParent = "../" + fileUtils.getShortFileName(htmlFile);

		if (children != null) {
			/* Second pass over children is the actual recursion down into the tree */
			for (SubNode n : children) {
				recurseNode(parentFolder + "/" + folder, n, level + 1, relParent);
			}
		}
	}

	/*
	 * NOTE: It's correct that there's no finally block in here enforcing the
	 * closeEntry, becasue we let exceptions bubble all the way up to abort and even
	 * cause the zip file itself (to be deleted) since it was unable to be written
	 * to.
	 * 
	 * fileNameCont is an output parameter that has the complete filename minus the
	 * period and extension.
	 */
	private String processNodeExport(String parentFolder, SubNode node, StringBuilder html, boolean writeFile,
			ValContainer<String> fileNameCont) {
		try {
			// log.debug("Processing Node: " + node.getPath());

			String fileName = generateFileNameFromNode(node);

			/*
			 * If we aren't writing the file we know we need the text appended to include a
			 * link to open the content
			 */
			if (!writeFile) {
				/*
				 * This is a slight ineffeciency for now, to call getChildCount, because
				 * eventually we will be trying to get the children for all nodes we encounter,
				 * so this will be redundant, but I don't want to refactor now to solve this
				 * yet. That's almost an optimization that should come later
				 */
				long childCount = api.getChildCount(node);
				if (childCount > 0) {
					String htmlFile = "./" + fileName + "/" + fileName + ".html";
					html.append("<a href='" + htmlFile + "'><button>Open</button></a><br>");
				}
			}

			String content = node.getContent() != null ? node.getContent() : "";
			content = content.trim();

			String escapedContent = StringEscapeUtils.escapeHtml4(content);
			html.append("\n<pre>" + escapedContent + "\n</pre>");

			String binFileNameProp = node.getStringProp(NodeProp.BIN_FILENAME.s());
			String binFileNameStr = binFileNameProp != null ? binFileNameProp : "binary";

			String mimeType = node.getStringProp(NodeProp.BIN_MIME.s());
			if (mimeType != null && mimeType.startsWith("image/")) {
				String relImgPath = writeFile ? "" : (fileName + "/");
				html.append("<br><img src='./" + relImgPath + binFileNameStr + "'/>");
			}

			if (writeFile) {
				fileNameCont.setVal(parentFolder + "/" + fileName + "/" + fileName);

				// todo-0: Reseach if MongoDb itself can render to JSON which might be 'better'
				// json to use? Like the native export format?
				String json = XString.prettyPrint(node);

				addFileEntry(parentFolder + "/" + fileName + "/" + fileName + ".json",
						json.getBytes(StandardCharsets.UTF_8));

				/* If content property was found write it into separate file */
				if (StringUtils.isNotEmpty(content)) {
					addFileEntry(parentFolder + "/" + fileName + "/" + fileName + ".md",
							content.getBytes(StandardCharsets.UTF_8));
				}

				/*
				 * If we had a binary property on this node we write the binary file into a
				 * separate file
				 */
				if (mimeType != null) {
					// AutoCloseInputStream is = attachmentService.getAutoClosingStream(session,
					// node, null, false, false);
					boolean ipfs = StringUtils.isNotEmpty(node.getStringProp(NodeProp.IPFS_LINK.s()));

					InputStream is = null;
					try {
						is = attachmentService.getStream(session, node, null, false, ipfs);
						BufferedInputStream bis = new BufferedInputStream(is);

						addFileEntry(parentFolder + "/" + fileName + "/" + binFileNameStr, IOUtils.toByteArray(bis));
					} finally {
						StreamUtil.close(is);
					}
				}

				return fileName;
			} else {
				return null;
			}
		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	private String cleanupFileName(String fileName) {
		fileName = fileName.trim();
		fileName = FileTools.ensureValidFileNameChars(fileName);
		fileName = XString.stripIfStartsWith(fileName, "-");
		fileName = XString.stripIfEndsWith(fileName, "-");
		return fileName;
	}

	private void addFileEntry(String fileName, byte[] bytes) {
		/*
		 * If we have duplicated a filename, number it sequentially to create a unique
		 * file
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

	private String generateFileNameFromNode(SubNode node) {
		String fileName = node.getName();

		if (StringUtils.isEmpty(fileName)) {
			fileName = node.getContent();
			if (fileName != null) {
				fileName = fileName.trim();
				fileName = XString.truncateAfterFirst(fileName, "\n");
				fileName = XString.truncateAfterFirst(fileName, "\r");
			}
		}

		if (StringUtils.isEmpty(fileName)) {
			fileName = node.getLastPathPart();
		}

		fileName = cleanupFileName(fileName);

		log.debug(" nodePath=[" + node.getPath() + "] fileName=[" + fileName + "]");

		fileName = XString.addLeadingZeroes(String.valueOf(node.getOrdinal()), 5) + "--"
				+ XString.trimToMaxLen(fileName, 40);
		return fileName;
	}
}
