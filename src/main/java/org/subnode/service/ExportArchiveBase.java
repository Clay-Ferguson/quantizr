package org.subnode.service;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

import org.subnode.config.AppProp;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.config.SessionContext;
import org.subnode.config.SpringContextUtil;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.UserPreferences;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.ExportRequest;
import org.subnode.response.ExportResponse;
import org.subnode.util.Const;
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
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Sort;

/**
 * Base class for exporting to archives (ZIP and TAR).
 * 
 * NOTE: Derived classes are expected to be 'prototype' scope so we can keep
 * state in this object on a per-export basis. That is, each time a user does an
 * export, a new instance of this class is created that is dedicated just do
 * doing that one export and so any member varibles in this class have just that
 * one export as their 'scope'
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

	private String rootPathParent;

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
			throw ExUtil.wrapEx("You are not authorized to export.");
		}

		if (!FileTools.dirExists(appProp.getAdminDataFolder())) {
			throw ExUtil.wrapEx("adminDataFolder does not exist: " + appProp.getAdminDataFolder());
		}

		String nodeId = req.getNodeId();

		shortFileName = "f" + util.getGUID() + "." + getFileExtension();
		fullFileName = appProp.getAdminDataFolder() + File.separator + shortFileName;

		boolean success = false;
		try {
			openOutputStream(fullFileName);
			writeRootFiles();

			SubNode node = api.getNode(session, nodeId);
			rootPathParent = node.getParentPath();
			api.authRequireOwnerOfNode(session, node);
			ArrayList<SubNode> nodeStack = new ArrayList<SubNode>();
			nodeStack.add(node);
			recurseNode("../", "", node, nodeStack, 0, null, null);
			res.setFileName(shortFileName);
			success = true;
		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		} finally {
			closeOutputStream();

			if (!success) {
				FileTools.deleteFile(fullFileName);
			}
		}

		res.setSuccess(true);
	}

	private void writeRootFiles() {
		writeRootFile("exported.js");
		writeRootFile("marked.min.js");
		writeRootFile("exported.css");
		writeRootFile("darcula.css");
	}

	private void writeRootFile(String fileName) {
		InputStream is = null;
		String resourceName = "classpath:/public/export-includes/" + fileName;
		try {
			Resource resource = SpringContextUtil.getApplicationContext().getResource(resourceName);
			is = resource.getInputStream();
			byte[] targetArray = IOUtils.toByteArray(is);
			addFileEntry(fileName, targetArray);
		} catch (Exception e) {
			throw new RuntimeEx("Unable to write resource: " + resourceName, e);
		} finally {
			StreamUtil.close(is);
		}
	}

	private void recurseNode(String rootPath, String parentFolder, SubNode node, ArrayList<SubNode> nodeStack,
			int level, String parentHtmlFile, String parentId) {
		if (node == null)
			return;

		log.debug("recurseNode: " + node.getContent() + " parentHtmlFile=" + parentHtmlFile);

		StringBuilder html = new StringBuilder();
		html.append("<html>");

		html.append("<head>\n");
		html.append("<link rel='stylesheet' href='" + rootPath + "exported.css' />");
		html.append("<link rel='stylesheet' href='" + rootPath + "darcula.css' />");
		html.append("</head>\n");

		html.append("<body>\n");

		// breadcrumbs at the top of each page.
		if (nodeStack.size() > 1) {
			StringBuilder sb = new StringBuilder();
			int max = nodeStack.size() - 1;
			int count = 0;
			for (SubNode bcNode : nodeStack) {
				if (sb.length() > 0) {
					sb.append(" / ");
				}
				String friendlyName = generateFileNameFromNode(bcNode);
				if (friendlyName != null) {
					sb.append(friendlyName);
				}
				count++;
				if (count >= max) {
					break;
				}
			}
			html.append("<div class='breadcrumbs'>" + sb.toString() + "</div>");
		}

		if (parentHtmlFile != null) {
			html.append("<a href='" + parentHtmlFile + (parentId != null ? "#" + parentId : "")
					+ "'><button class='uplevel-button'>Up Level</button></a><br style='height:20px;'>");
		}

		/* process the current node */
		ValContainer<String> fileName = new ValContainer<String>();

		Iterable<SubNode> iter = api.getChildren(session, node, Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL),
				null);
		List<SubNode> children = api.iterateToList(iter);

		/*
		 * This is the header row at the top of the page. The rest of the page is
		 * children of this node
		 */
		html.append("<div class='top-row'/>");
		processNodeExport(session, parentFolder, node, nodeStack, html, true, fileName);
		html.append("</div>");
		String folder = node.getId().toHexString();

		if (children != null) {
			int childCount = 0;

			/*
			 * First pass over children is to embed their content onto the child display on
			 * the current page
			 */
			for (SubNode n : children) {
				if (childCount > 0) {
					html.append("<hr class='hr-row'/>");
				}

				processNodeExport(session, parentFolder, n, nodeStack, html, false, null);
				childCount++;
			}
		}

		html.append("<script src='" + rootPath + "marked.min.js'></script>");
		html.append("<script src='" + rootPath + "exported.js'></script>");

		html.append("</body></html>");
		String htmlFile = fileName.getVal() + ".html";
		addFileEntry(htmlFile, html.toString().getBytes(StandardCharsets.UTF_8));

		String relParent = "../" + fileUtils.getShortFileName(htmlFile);

		if (children != null) {
			/* Second pass over children is the actual recursion down into the tree */
			for (SubNode n : children) {
				nodeStack.add(n);
				recurseNode(rootPath + "../", parentFolder + "/" + folder, n, nodeStack, level + 1, relParent,
						n.getId().toHexString());
				nodeStack.remove(n);
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
	private void processNodeExport(MongoSession session, String parentFolder, SubNode node,
			ArrayList<SubNode> nodeStack, StringBuilder html, boolean writeFile, ValContainer<String> fileNameCont) {
		try {
			// log.debug("Processing Node: " + node.getPath());

			String nodeId = node.getId().toHexString();
			String fileName = nodeId;

			html.append("<div href='#" + nodeId + "' class='row-div' id='" + nodeId + "'>");

			html.append("<div class='meta-info'>" + nodeId + "</div>");

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
				long childCount = api.getChildCount(session, node);
				if (childCount > 0) {
					String htmlFile = "./" + fileName + "/" + fileName + ".html";
					html.append("<a href='" + htmlFile + "'><button class='open-button'>Open</button></a><br>");
				}
			}

			String content = node.getContent() != null ? node.getContent() : "";
			content = content.trim();

			String escapedContent = StringEscapeUtils.escapeHtml4(content);
			if (node.getType().equals(NodeType.PLAIN_TEXT.s())) {
				html.append("\n<pre>" + escapedContent + "\n</pre>");
			} else {
				html.append("\n<div class='markdown container'>" + escapedContent + "\n</div>");
			}

			String binFileNameProp = node.getStringProp(NodeProp.BIN_FILENAME.s());
			String binFileNameStr = binFileNameProp != null ? binFileNameProp : "binary";

			String ipfsLink = node.getStringProp(NodeProp.IPFS_LINK.s());

			String mimeType = node.getStringProp(NodeProp.BIN_MIME.s());

			String imgUrl = null;
			String attachmentUrl = null;

			/*
			 * if this is a 'data:' encoded image read it from binary storage and put that
			 * directly in url src
			 */
			String dataUrl = node.getStringProp(NodeProp.BIN_DATA_URL.s());
			if ("t".equals(dataUrl)) {
				imgUrl = attachmentService.getStringByNode(session, node);

				// sanity check here.
				if (!imgUrl.startsWith("data:")) {
					imgUrl = null;
				}
			}
			// Otherwise if this is an ordinary binary image, encode the link to it.
			else if (mimeType != null && mimeType.startsWith("image/")) {
				String relImgPath = writeFile ? "" : (fileName + "/");
				/*
				 * embeds an image that's 400px wide until you click it which makes it go
				 * fullsize
				 * 
				 */
				imgUrl = StringUtils.isEmpty(ipfsLink) ? ("./" + relImgPath + nodeId + "-" + binFileNameStr)
						: (Const.IPFS_IO_GATEWAY + ipfsLink);
			} else if (mimeType != null) {
				String relPath = writeFile ? "" : (fileName + "/");
				/*
				 * embeds an image that's 400px wide until you click it which makes it go
				 * fullsize
				 */
				attachmentUrl = StringUtils.isEmpty(ipfsLink) ? ("./" + relPath + nodeId + "-" + binFileNameStr)
						: (Const.IPFS_IO_GATEWAY + ipfsLink);
			}

			if (imgUrl != null) {
				html.append("<br><img title='" + binFileNameStr + "' id='img_" + nodeId
						+ "' style='width:400px' onclick='document.getElementById(\"img_" + nodeId
						+ "\").style.width=\"\"' src='" + imgUrl + "'/>");
			} //
			else if (attachmentUrl != null) {
				html.append(
						"<br><a class='link' target='_blank' href='" + attachmentUrl + "'>Attachment: " + binFileNameStr + "</a>");
			}

			html.append("</div>");

			if (writeFile) {
				fileNameCont.setVal(parentFolder + "/" + fileName + "/" + fileName);

				/*
				 * Pretty print the node having the relative path, and then restore the node to
				 * the full path
				 */
				String fullPath = node.getPath();
				String relPath = fullPath.substring(rootPathParent.length());
				node.setPath(relPath);
				String json = XString.prettyPrint(node);
				node.setPath(fullPath);

				addFileEntry(parentFolder + "/" + fileName + "/" + fileName + ".json",
						json.getBytes(StandardCharsets.UTF_8));

				/* If content property was found write it into separate file */
				if (StringUtils.isNotEmpty(content)) {
					addFileEntry(parentFolder + "/" + fileName + "/" + fileName + ".md",
							content.getBytes(StandardCharsets.UTF_8));
				}

				/*
				 * If we had a binary property on this node we write the binary file into a
				 * separate file, but for ipfs links we do NOT do this
				 */
				if (mimeType != null && StringUtils.isEmpty(ipfsLink)) {

					InputStream is = null;
					try {
						is = attachmentService.getStream(session, node, false, false);
						BufferedInputStream bis = new BufferedInputStream(is);
						long length = node.getIntProp(NodeProp.BIN_SIZE.s());
						String binFileName = parentFolder + "/" + fileName + "/" + nodeId + "-" + binFileNameStr;

						if (length > 0) {
							/* NOTE: the archive WILL fail if no length exists in this codepath */
							addFileEntry(binFileName, bis, length);
						} else {
							/*
							 * This *should* never happen that we fall back to writing as an array from the
							 * input stream because normally we will always have the length saved on the
							 * node. But re are trying to be as resilient as possible here falling back to
							 * this rather than failing the entire export
							 */
							addFileEntry(binFileName, IOUtils.toByteArray(bis));
						}
					} finally {
						StreamUtil.close(is);
					}
				}
			}
		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
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

	private void addFileEntry(String fileName, InputStream is, long length) {
		if (length <= 0) {
			throw new RuntimeEx("length is required");
		}
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

		addEntry(fileName, is, length);
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

		fileName = XString.trimToMaxLen(fileName, 40);
		return fileName;
	}

	public abstract String getFileExtension();

	public abstract void openOutputStream(String fileName);

	public abstract void closeOutputStream();

	public abstract void addEntry(String fileName, byte[] bytes);

	public abstract void addEntry(String fileName, InputStream stream, long length);
}
