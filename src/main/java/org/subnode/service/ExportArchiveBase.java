package org.subnode.service;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

import org.apache.commons.io.FilenameUtils;
import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringEscapeUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Sort;
import org.subnode.config.AppProp;
import org.subnode.config.SpringContextUtil;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.MongoAuth;
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
import org.subnode.util.ValContainer;
import org.subnode.util.XString;

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
	private MongoRead read;

	@Autowired
	private MongoAuth auth;

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
	private final HashSet<String> fileNameSet = new HashSet<String>();

	@Autowired
	private AppProp appProp;

	private MongoSession session;

	public void export(MongoSession session, final ExportRequest req, final ExportResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		this.session = session;

		if (!FileUtils.dirExists(appProp.getAdminDataFolder())) {
			throw ExUtil.wrapEx("adminDataFolder does not exist: " + appProp.getAdminDataFolder());
		}

		final String nodeId = req.getNodeId();
		final SubNode node = read.getNode(session, nodeId);
		String fileName = util.getExportFileName(req.getFileName(), node);
		shortFileName = fileName + "." + getFileExtension();
		fullFileName = appProp.getAdminDataFolder() + File.separator + shortFileName;

		boolean success = false;
		try {
			openOutputStream(fullFileName);
			writeRootFiles();
			rootPathParent = node.getParentPath();
			auth.authRequireOwnerOfNode(session, node);
			final ArrayList<SubNode> nodeStack = new ArrayList<SubNode>();
			nodeStack.add(node);
			recurseNode("../", "", node, nodeStack, 0, null, null);
			res.setFileName(shortFileName);
			success = true;
		} catch (final Exception ex) {
			throw ExUtil.wrapEx(ex);
		} finally {
			closeOutputStream();

			if (!success) {
				FileUtils.deleteFile(fullFileName);
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

	private void writeRootFile(final String fileName) {
		InputStream is = null;
		final String resourceName = "classpath:/public/export-includes/" + fileName;
		try {
			final Resource resource = SpringContextUtil.getApplicationContext().getResource(resourceName);
			is = resource.getInputStream();
			final byte[] targetArray = IOUtils.toByteArray(is);
			addFileEntry(fileName, targetArray);
		} catch (final Exception e) {
			throw new RuntimeEx("Unable to write resource: " + resourceName, e);
		} finally {
			StreamUtil.close(is);
		}
	}

	private void recurseNode(final String rootPath, final String parentFolder, final SubNode node,
			final ArrayList<SubNode> nodeStack, final int level, final String parentHtmlFile, final String parentId) {
		if (node == null)
			return;

		log.debug("recurseNode: " + node.getContent() + " parentHtmlFile=" + parentHtmlFile);

		final StringBuilder html = new StringBuilder();
		html.append("<html>");

		html.append("<head>\n");
		html.append("<link rel='stylesheet' href='" + rootPath + "exported.css' />");
		html.append("<link rel='stylesheet' href='" + rootPath + "darcula.css' />");
		html.append("</head>\n");

		html.append("<body>\n");

		// breadcrumbs at the top of each page.
		if (nodeStack.size() > 1) {
			final StringBuilder sb = new StringBuilder();
			final int max = nodeStack.size() - 1;
			int count = 0;
			for (final SubNode bcNode : nodeStack) {
				if (sb.length() > 0) {
					sb.append(" / ");
				}
				final String friendlyName = generateFileNameFromNode(bcNode);
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
					+ "'><button class='uplevel-button'>Up Level</button></a>");
		}

		/* process the current node */
		final ValContainer<String> fileName = new ValContainer<String>();

		final Iterable<SubNode> iter = read.getChildren(session, node,
				Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL), null, 0);
		final List<SubNode> children = read.iterateToList(iter);

		/*
		 * This is the header row at the top of the page. The rest of the page is
		 * children of this node
		 */
		html.append("<div class='top-row'/>\n");
		processNodeExport(session, parentFolder, "", node, html, true, fileName, true, 0, true);
		html.append("</div>\n");
		final String folder = node.getId().toHexString();

		if (children != null) {
			/*
			 * First pass over children is to embed their content onto the child display on
			 * the current page
			 */
			for (final SubNode n : children) {
				final String inlineChildren = n.getStringProp(NodeProp.INLINE_CHILDREN.s());
				final boolean allowOpenButton = !"1".equals(inlineChildren);

				processNodeExport(session, parentFolder, "", n, html, false, null, allowOpenButton, 0, false);

				if ("1".equals(inlineChildren)) {
					final String subFolder = n.getId().toHexString();
					// log.debug("Inline Node: "+node.getContent()+" subFolder="+subFolder);
					inlineChildren(html, n, parentFolder, subFolder + "/", 1);
				}
			}
		}

		html.append("<script src='" + rootPath + "marked.min.js'></script>");
		html.append("<script src='" + rootPath + "exported.js'></script>");

		html.append("</body></html>");
		final String htmlFile = fileName.getVal() + ".html";
		addFileEntry(htmlFile, html.toString().getBytes(StandardCharsets.UTF_8));

		final String relParent = "../" + fileUtils.getShortFileName(htmlFile);

		if (children != null) {
			/* Second pass over children is the actual recursion down into the tree */
			for (final SubNode n : children) {
				nodeStack.add(n);
				recurseNode(rootPath + "../", parentFolder + "/" + folder, n, nodeStack, level + 1, relParent,
						n.getId().toHexString());
				nodeStack.remove(n);
			}
		}
	}

	private void inlineChildren(final StringBuilder html, final SubNode node, final String parentFolder,
			final String deeperPath, final int level) {
		final Iterable<SubNode> iter = read.getChildren(session, node,
				Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL), null, 0);
		final List<SubNode> children = read.iterateToList(iter);

		if (children != null) {
			/*
			 * First pass over children is to embed their content onto the child display on
			 * the current page
			 */
			for (final SubNode n : children) {
				final String inlineChildren = n.getStringProp(NodeProp.INLINE_CHILDREN.s());
				final boolean allowOpenButton = !"1".equals(inlineChildren);
				final String folder = n.getId().toHexString();

				processNodeExport(session, parentFolder, deeperPath, n, html, false, null, allowOpenButton, level,
						false);

				if ("1".equals(inlineChildren)) {
					inlineChildren(html, n, parentFolder, deeperPath + folder + "/", level + 1);
				}
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
	private void processNodeExport(final MongoSession session, final String parentFolder, final String deeperPath,
			final SubNode node, final StringBuilder html, final boolean writeFile,
			final ValContainer<String> fileNameCont, final boolean allowOpenButton, final int level,
			final boolean isTopRow) {
		try {
			// log.debug("Processing Node: " + node.getContent()+" parentFolder:
			// "+parentFolder);

			final String nodeId = node.getId().toHexString();
			final String fileName = nodeId;
			final String rowClass = isTopRow ? "" : "class='row-div'";

			String indenter = "";
			if (level > 0) {
				indenter = " style='margin-left:" + String.valueOf(level * 30) + "px'";
			}
			html.append("<div href='#" + nodeId + "' " + rowClass + " id='" + nodeId + "' " + indenter + ">\n");

			html.append("<div class='meta-info'>" + nodeId + "</div>\n");

			/*
			 * If we aren't writing the file we know we need the text appended to include a
			 * link to open the content
			 */
			if (!writeFile && allowOpenButton) {
				/*
				 * This is a slight ineffeciency for now, to call getChildCount, because
				 * eventually we will be trying to get the children for all nodes we encounter,
				 * so this will be redundant, but I don't want to refactor now to solve this
				 * yet. That's almost an optimization that should come later
				 */
				boolean hasChildren = read.hasChildren(session, node);
				if (hasChildren) {
					final String htmlFile = "./" + deeperPath + fileName + "/" + fileName + ".html";
					html.append("<a href='" + htmlFile + "'><button class='open-button'>Open</button></a>");
				}
			}

			String content = node.getContent() != null ? node.getContent() : "";
			content = content.trim();

			final String escapedContent = StringEscapeUtils.escapeHtml4(content);
			if (node.getType().equals(NodeType.PLAIN_TEXT.s())) {
				html.append("\n<pre>" + escapedContent + "\n</pre>");
			} else {
				html.append("\n<div class='markdown container'>" + escapedContent + "\n</div>");
			}

			String ext = null;
			final String binFileNameProp = node.getStringProp(NodeProp.BIN_FILENAME.s());
			if (binFileNameProp != null) {
				ext = FilenameUtils.getExtension(binFileNameProp);
				if (!StringUtils.isEmpty(ext)) {
					ext = "." + ext;
				}
			}
			final String binFileNameStr = binFileNameProp != null ? binFileNameProp : "binary";

			// final String ipfsLink = node.getStringProp(NodeProp.IPFS_LINK.s());
			final String mimeType = node.getStringProp(NodeProp.BIN_MIME.s());

			String imgUrl = null;
			String attachmentUrl = null;
			boolean rawDataUrl = false;

			/*
			 * if this is a 'data:' encoded image read it from binary storage and put that
			 * directly in url src
			 */
			final String dataUrl = node.getStringProp(NodeProp.BIN_DATA_URL.s());

			if ("t".equals(dataUrl)) {
				imgUrl = attachmentService.getStringByNode(session, node);

				// sanity check here.
				if (!imgUrl.startsWith("data:")) {
					imgUrl = null;
				} else {
					rawDataUrl = true;
					html.append("<img title='" + binFileNameStr + "' id='img_" + nodeId
							+ "' style='width:200px' onclick='document.getElementById(\"img_" + nodeId
							+ "\").style.width=\"\"' src='" + imgUrl + "'/>");
				}
			}

			if (!rawDataUrl && mimeType != null) {
				// Otherwise if this is an ordinary binary image, encode the link to it.
				if (imgUrl == null && mimeType.startsWith("image/")) {
					final String relImgPath = writeFile ? "" : (fileName + "/");
					/*
					 * embeds an image that's 400px wide until you click it which makes it go
					 * fullsize
					 * 
					 */

					// Theoretically we could exclude the IPFS data and just export a link to a
					// gateway but instead we export the file
					// imgUrl = StringUtils.isEmpty(ipfsLink) ? ("./" + relImgPath + nodeId + ext)
					// : (Const.IPFS_IO_GATEWAY + ipfsLink);

					imgUrl = "./" + relImgPath + nodeId + ext;

					html.append("<img title='" + binFileNameStr + "' id='img_" + nodeId
							+ "' style='width:200px' onclick='document.getElementById(\"img_" + nodeId
							+ "\").style.width=\"\"' src='" + imgUrl + "'/>");
				} else {
					final String relPath = writeFile ? "" : (fileName + "/");
					/*
					 * embeds an image that's 400px wide until you click it which makes it go
					 * fullsize
					 */
					// Theoretically we could exclude the IPFS data and just export a link to a
					// gateway but instead we export the file
					// attachmentUrl = StringUtils.isEmpty(ipfsLink) ? ("./" + relPath + nodeId +
					// ext)
					// : (Const.IPFS_IO_GATEWAY + ipfsLink);
					attachmentUrl = "./" + relPath + nodeId + ext;

					html.append("<a class='link' target='_blank' href='" + attachmentUrl + "'>Attachment: "
							+ binFileNameStr + "</a>");
				}
			}

			html.append("</div>\n");

			if (writeFile) {
				fileNameCont.setVal(parentFolder + "/" + fileName + "/" + fileName);

				/*
				 * Pretty print the node having the relative path, and then restore the node to
				 * the full path
				 */
				final String fullPath = node.getPath();
				final String relPath = fullPath.substring(rootPathParent.length());
				node.setPath(relPath);
				final String json = XString.prettyPrint(node);
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
				if (!rawDataUrl && mimeType != null) {

					InputStream is = null;
					try {
						is = attachmentService.getStream(session, "", node, false);
						final BufferedInputStream bis = new BufferedInputStream(is);
						final long length = node.getIntProp(NodeProp.BIN_SIZE.s());
						final String binFileName = parentFolder + "/" + fileName + "/" + nodeId + ext;

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
		} catch (final Exception ex) {
			throw ExUtil.wrapEx(ex);
		}
	}

	private String cleanupFileName(String fileName) {
		fileName = fileName.trim();
		fileName = FileUtils.ensureValidFileNameChars(fileName);
		fileName = XString.stripIfStartsWith(fileName, "-");
		fileName = XString.stripIfEndsWith(fileName, "-");
		return fileName;
	}

	private void addFileEntry(String fileName, final byte[] bytes) {
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

	private void addFileEntry(String fileName, final InputStream is, final long length) {
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

	private String generateFileNameFromNode(final SubNode node) {
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
