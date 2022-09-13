package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
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
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Sort;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
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
import quanta.util.Val;
import quanta.util.XString;

/**
 * Base class for exporting to archives (ZIP and TAR).
 * 
 * NOTE: Derived classes are expected to be 'prototype' scope so we can keep state in this object on
 * a per-export basis. That is, each time a user does an export, a new instance of this class is
 * created that is dedicated just do doing that one export and so any member varibles in this class
 * have just that one export as their 'scope'
 */
public abstract class ExportArchiveBase extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(ExportArchiveBase.class);

	private String shortFileName;
	private String fullFileName;
	private String rootPathParent;

	/*
	 * It's possible that nodes recursively contained under a given node can have same name, so we have
	 * to detect that and number them, so we use this hashset to detect existing filenames.
	 */
	private final HashSet<String> fileNameSet = new HashSet<>();

	private MongoSession session;

	public void export(MongoSession ms, ExportRequest req, ExportResponse res) {
		ms = ThreadLocals.ensure(ms);
		this.session = ms;

		if (!FileUtils.dirExists(prop.getAdminDataFolder())) {
			throw ExUtil.wrapEx("adminDataFolder does not exist: " + prop.getAdminDataFolder());
		}

		String nodeId = req.getNodeId();
		SubNode node = read.getNode(ms, nodeId);
		String fileName = snUtil.getExportFileName(req.getFileName(), node);
		shortFileName = fileName + "." + getFileExtension();
		fullFileName = prop.getAdminDataFolder() + File.separator + shortFileName;

		boolean success = false;
		try {
			openOutputStream(fullFileName);
			writeRootFiles();
			rootPathParent = node.getParentPath();
			auth.ownerAuth(ms, node);
			ArrayList<SubNode> nodeStack = new ArrayList<>();
			nodeStack.add(node);
			recurseNode("../", "", node, nodeStack, 0, null, null);
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

		res.setSuccess(true);
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

	private void recurseNode(String rootPath, String parentFolder, SubNode node, ArrayList<SubNode> nodeStack, int level,
			String parentHtmlFile, String parentId) {
		if (no(node))
			return;

		log.debug("recurseNode: " + node.getContent() + " parentHtmlFile=" + parentHtmlFile);

		StringBuilder html = new StringBuilder();
		html.append("<html>");

		html.append("<head>\n");
		html.append("<link rel='stylesheet' href='" + rootPath + "exported.css' />");
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
				String friendlyName = generateFriendlyName(bcNode);
				if (ok(friendlyName)) {
					sb.append(friendlyName);
				}
				count++;
				if (count >= max) {
					break;
				}
			}
			html.append("<div class='breadcrumbs'>" + sb.toString() + "</div>");
		}

		if (ok(parentHtmlFile)) {
			html.append("<a href='" + parentHtmlFile + (ok(parentId) ? "#" + parentId : "")
					+ "'><button class='uplevel-button'>Up Level</button></a>");
		}

		/* process the current node */
		Val<String> fileName = new Val<>();
		Iterable<SubNode> iter = read.getChildren(session, node, Sort.by(Sort.Direction.ASC, SubNode.ORDINAL), null, 0);

		/*
		 * This is the header row at the top of the page. The rest of the page is children of this node
		 */
		html.append("<div class='top-row'/>\n");
		processNodeExport(session, parentFolder, "", node, html, true, fileName, true, 0, true);
		html.append("</div>\n");
		String folder = node.getIdStr();

		if (ok(iter)) {
			/*
			 * First pass over children is to embed their content onto the child display on the current page
			 */
			for (SubNode n : iter) {
				String inlineChildren = n.getStr(NodeProp.INLINE_CHILDREN);
				boolean allowOpenButton = !"1".equals(inlineChildren);

				processNodeExport(session, parentFolder, "", n, html, false, null, allowOpenButton, 0, false);

				if ("1".equals(inlineChildren)) {
					String subFolder = n.getIdStr();
					// log.debug("Inline Node: "+node.getContent()+" subFolder="+subFolder);
					inlineChildren(html, n, parentFolder, subFolder + "/", 1);
				}
			}
		}

		html.append("<script src='" + rootPath + "marked.min.js'></script>");
		html.append("<script src='" + rootPath + "exported.js'></script>");

		html.append("</body></html>");
		String htmlFile = fileName.getVal() + ".html";
		addFileEntry(htmlFile, html.toString().getBytes(StandardCharsets.UTF_8));

		String relParent = "../" + fileUtil.getShortFileName(htmlFile);

		if (ok(iter)) {
			/* Second pass over children is the actual recursion down into the tree */
			for (SubNode n : iter) {
				nodeStack.add(n);
				recurseNode(rootPath + "../", parentFolder + "/" + folder, n, nodeStack, level + 1, relParent, n.getIdStr());
				nodeStack.remove(n);
			}
		}
	}

	private void inlineChildren(StringBuilder html, SubNode node, String parentFolder, String deeperPath, int level) {
		Iterable<SubNode> iter = read.getChildren(session, node, Sort.by(Sort.Direction.ASC, SubNode.ORDINAL), null, 0);
		if (ok(iter)) {
			/*
			 * First pass over children is to embed their content onto the child display on the current page
			 */
			for (SubNode n : iter) {
				String inlineChildren = n.getStr(NodeProp.INLINE_CHILDREN);
				boolean allowOpenButton = !"1".equals(inlineChildren);
				String folder = n.getIdStr();

				processNodeExport(session, parentFolder, deeperPath, n, html, false, null, allowOpenButton, level, false);

				if ("1".equals(inlineChildren)) {
					inlineChildren(html, n, parentFolder, deeperPath + folder + "/", level + 1);
				}
			}
		}
	}

	/*
	 * NOTE: It's correct that there's no finally block in here enforcing the closeEntry, becasue we let
	 * exceptions bubble all the way up to abort and even cause the zip file itself (to be deleted)
	 * since it was unable to be written to.
	 * 
	 * fileNameCont is an output parameter that has the complete filename minus the period and
	 * extension.
	 */
	private void processNodeExport(MongoSession ms, String parentFolder, String deeperPath, SubNode node, StringBuilder html,
			boolean writeFile, Val<String> fileNameCont, boolean allowOpenButton, int level, boolean isTopRow) {
		try {
			// log.debug("Processing Node: " + node.getContent()+" parentFolder:
			// "+parentFolder);

			String nodeId = node.getIdStr();
			String fileName = nodeId;
			String rowClass = isTopRow ? "" : "class='row-div'";

			String indenter = "";
			if (level > 0) {
				indenter = " style='margin-left:" + String.valueOf(level * 30) + "px'";
			}
			html.append("<div href='#" + nodeId + "' " + rowClass + " id='" + nodeId + "' " + indenter + ">\n");
			html.append("<div class='meta-info'>" + nodeId + "</div>\n");

			/*
			 * If we aren't writing the file we know we need the text appended to include a link to open the
			 * content
			 */
			if (!writeFile && allowOpenButton) {
				/*
				 * This is a slight ineffeciency for now, to call getChildCount, because eventually we will be
				 * trying to get the children for all nodes we encounter, so this will be redundant, but I don't
				 * want to refactor now to solve this yet. That's almost an optimization that should come later
				 */
				boolean hasChildren = read.hasChildren(ms, node, true, false);
				if (hasChildren) {
					String htmlFile = "./" + deeperPath + fileName + "/" + fileName + ".html";
					html.append("<a href='" + htmlFile + "'><button class='open-button'>Open</button></a>");
				}
			}

			String content = ok(node.getContent()) ? node.getContent() : "";
			content = content.trim();

			String escapedContent = StringEscapeUtils.escapeHtml4(content);
			if (node.isType(NodeType.PLAIN_TEXT)) {
				html.append("\n<pre>" + escapedContent + "\n</pre>");
			} else {
				html.append("\n<div class='markdown container'>" + escapedContent + "\n</div>");
			}

			String ext = null;
			String binFileNameProp = node.getStr(NodeProp.BIN_FILENAME);
			if (ok(binFileNameProp)) {
				ext = FilenameUtils.getExtension(binFileNameProp);
				if (!StringUtils.isEmpty(ext)) {
					ext = "." + ext;
				}
			}
			String binFileNameStr = ok(binFileNameProp) ? binFileNameProp : "binary";

			String mimeType = node.getStr(NodeProp.BIN_MIME);

			String imgUrl = null;
			String attachmentUrl = null;
			boolean rawDataUrl = false;

			/*
			 * if this is a 'data:' encoded image read it from binary storage and put that directly in url src
			 */
			String dataUrl = node.getStr(NodeProp.BIN_DATA_URL);
			if ("t".equals(dataUrl)) {
				imgUrl = attach.getStringByNode(ms, node);

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

			if (!rawDataUrl && ok(mimeType)) {
				// Otherwise if this is an ordinary binary image, encode the link to it.
				if (no(imgUrl) && mimeType.startsWith("image/")) {

					// If this is an external URL (just a URL to an image on the web)
					String extUrl = node.getStr(NodeProp.BIN_URL);
					if (ok(extUrl)) {
						binFileNameStr = "External image";
						imgUrl = extUrl;
					}
					// otherwise it's an internal image so get imgUrl that way
					else {
						String relImgPath = writeFile ? "" : (fileName + "/");
						/*
						 * embeds an image that's 400px wide until you click it which makes it go fullsize
						 * 
						 */

						imgUrl = "./" + deeperPath + relImgPath + nodeId + ext;
					}

					html.append("<img title='" + binFileNameStr + "' id='img_" + nodeId
							+ "' style='width:200px' onclick='document.getElementById(\"img_" + nodeId
							+ "\").style.width=\"\"' src='" + imgUrl + "'/>");
				} else {
					String relPath = writeFile ? "" : (fileName + "/");
					/*
					 * embeds an image that's 400px wide until you click it which makes it go fullsize
					 */
					attachmentUrl = "./" + deeperPath + relPath + nodeId + ext;

					html.append("<a class='link' target='_blank' href='" + attachmentUrl + "'>Attachment: " + binFileNameStr
							+ "</a>");
				}
			}

			html.append("</div>\n");

			if (writeFile) {
				fileNameCont.setVal(parentFolder + "/" + fileName + "/" + fileName);

				/*
				 * Pretty print the node having the relative path, and then restore the node to the full path
				 */
				String fullPath = node.getPath();
				String relPath = fullPath.substring(rootPathParent.length());
				String json = null;
				try {
					node.directSetPath(relPath);
					json = XString.prettyPrint(node);
				} finally {
					node.directSetPath(fullPath);
				}

				addFileEntry(parentFolder + "/" + fileName + "/" + fileName + ".json", json.getBytes(StandardCharsets.UTF_8));

				/* If content property was found write it into separate file */
				if (StringUtils.isNotEmpty(content)) {
					addFileEntry(parentFolder + "/" + fileName + "/" + fileName + ".md",
							content.getBytes(StandardCharsets.UTF_8));
				}

				/*
				 * If we had a binary property on this node we write the binary file into a separate file, but for
				 * ipfs links we do NOT do this
				 */
				if (!rawDataUrl && ok(mimeType)) {

					InputStream is = null;
					try {
						is = attach.getStream(ms, "", node, false);
						if (ok(is)) {
							BufferedInputStream bis = new BufferedInputStream(is);
							long length = node.getInt(NodeProp.BIN_SIZE);
							String binFileName = parentFolder + "/" + fileName + "/" + nodeId + ext;

							if (length > 0) {
								/* NOTE: the archive WILL fail if no length exists in this codepath */
								addFileEntry(binFileName, bis, length);
							} else {
								/*
								 * This *should* never happen that we fall back to writing as an array from the input stream
								 * because normally we will always have the length saved on the node. But re are trying to be as
								 * resilient as possible here falling back to this rather than failing the entire export
								 */
								addFileEntry(binFileName, IOUtils.toByteArray(bis));
							}
						}
					} catch (Exception e) {
						throw ExUtil.wrapEx(e);
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
		fileName = FileUtils.ensureValidFileNameChars(fileName);
		fileName = XString.stripIfStartsWith(fileName, "-");
		fileName = XString.stripIfEndsWith(fileName, "-");
		return fileName;
	}

	private void addFileEntry(String fileName, byte[] bytes) {
		log.debug("addFileEntry: " + fileName);
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

	private String generateFriendlyName(SubNode node) {
		String fileName = node.getName();

		if (StringUtils.isEmpty(fileName)) {
			fileName = node.getContent();
			if (ok(fileName)) {
				fileName = fileName.trim();
				fileName = XString.truncAfterFirst(fileName, "\n");
				fileName = XString.truncAfterFirst(fileName, "\r");
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
