package org.subnode.service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.URLConnection;
import java.util.HashMap;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.subnode.config.SessionContext;
import org.subnode.config.SpringContextUtil;
import org.subnode.model.UserPreferences;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.ExUtil;
import org.subnode.util.LimitedInputStreamEx;
import org.subnode.util.MimeUtil;
import org.subnode.util.StreamUtil;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.XString;

import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Scope;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

/**
 * Import from ZIP files. Imports zip files that have the same type of directory
 * structure and content as the zip files that are exported from SubNode. The
 * zip file doesn't of course have to have been actually exported from SubNode
 * in order to import it, but merely have the proper layout/content.
 */
@Component
@Scope("prototype")
public class ImportZipService {
	private static final Logger log = LoggerFactory.getLogger(ImportZipService.class);

	// This is used to detect if this 'prototype scope' object might have been
	// autowired, and is getting called for
	// a second time which is NOT supported. Each use of this object requires a new
	// instance of it.
	private boolean used;

	@Autowired
	private MongoApi api;

	@Autowired
	private AttachmentService attachmentService;

	@Autowired
	private MimeUtil mimeUtil;

	@Autowired
	private SubNodeUtil apiUtil;

	@Autowired
	private JsonToSubNodeService jsonToNodeService;

	@Autowired
	private SessionContext sessionContext;

	private String targetPath;

	private ZipInputStream zis = null;
	private MongoSession session;

	/*
	 * Since the TXT file could be encountered BEFORE the JSON file, we have to use
	 * this variable to hold the content because we cannot create the actual node we
	 * will write to UNTIL we see the JSON file so we can get the correct path
	 * constructed from that. If this is null, it means there was no content file or
	 * else it has already been written out.
	 */
	private String curContent = null;
	private String curFileName = null;
	private SubNode curNode = null;

	private SubNode importRootNode;

	/*
	 * Since Zip files don't in all cases support Directories (only Files) we have
	 * to check the path on each file, and whenever we see a new path part of any
	 * file then THAT is the only reliable tway to determine that a new folder is
	 * being processed, so this curPath is how we do this.
	 */
	private String curPath = null;

	/*
	 * for performance we create a map of folders (relative names, directly from the
	 * zip file, as the key), and only the PARTIAL path (paths from Zip) rather than
	 * full path which would include targetPath prefix.
	 */
	private HashMap<String, SubNode> folderMap = new HashMap<String, SubNode>();

	// imports the file directly from an internal resource file (classpath resource,
	// built into WAR file itself)
	public SubNode inputZipFileFromResource(MongoSession session, String resourceName, SubNode node, String nodeName) {

		Resource resource = SpringContextUtil.getApplicationContext().getResource(resourceName);
		InputStream is = null;
		SubNode rootNode = null;
		try {
			is = resource.getInputStream();
			rootNode = inputZipFileFromStream(session, is, node, true);
		} catch (Exception e) {
			throw ExUtil.newEx(e);
		} finally {
			StreamUtil.close(is);
		}

		log.debug("Finished Input From Zip file.");
		api.saveSession(session);

		if (nodeName != null) {
			api.renameNode(session, rootNode, nodeName);
			api.save(session, rootNode);
			log.debug("CurNode Saved (renamed): " + rootNode.getPath());
			api.saveSession(session);
		}

		return rootNode;
	}

	/* Returns the first node created which is always the root of the import */
	public SubNode inputZipFileFromStream(MongoSession session, InputStream is, SubNode node,
			boolean isNonRequestThread) {
		if (used) {
			throw new RuntimeException("Prototype bean used multiple times is not allowed.");
		}
		used = true;

		if (!isNonRequestThread) {
			UserPreferences userPreferences = sessionContext.getUserPreferences();
			boolean importAllowed = userPreferences != null ? userPreferences.isImportAllowed() : false;
			if (!importAllowed && !sessionContext.isAdmin()) {
				throw ExUtil.newEx("You are not authorized to import.");
			}
		}

		try {
			targetPath = node.getPath();
			this.session = session;

			zis = new ZipInputStream(is);
			ZipEntry entry;
			while ((entry = zis.getNextEntry()) != null) {
				if (entry.isDirectory()) {
					/*
					 * WARNING: This method is here for clarity but usually will NOT BE CALLED. The
					 * Zip file format doesn't require folders to be stored but only FILES, and
					 * actually the full path on each file is what determines the hierarchy.
					 */
					processDirectory(entry);
				} else {
					processFile(entry);
				}
				zis.closeEntry();
			}
			// save last node (required, it won't get saved without this)
			saveIfPending();
			zis.close(); //todo-1: this close should be in a finally block
		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
		return importRootNode;
	}

	/*
	 * WARNING: This NEVER GETS CALLED, and it's by design. Zip Files aren't
	 * required to have callbacks for folders usually DON'T!
	 */
	private void processDirectory(ZipEntry entry) {
	}

	private SubNode ensureNodeExists(String path) {
		SubNode folderNode = folderMap.get(path);
		if (folderNode == null) {
			folderNode = apiUtil.ensureNodeExists(session, targetPath, path, null, null, true, null, null);
		}

		if (importRootNode == null) {
			importRootNode = folderNode;
		}

		if (folderNode == null) {
			throw ExUtil.newEx("Unable to create node: " + path);
		}

		// log.debug("Path Node created: " + path);
		folderMap.put(path, folderNode);
		return folderNode;
	}

	private String hashizePath(String path) {
		List<String> pathItems = XString.tokenize(path, "/", true);
		StringBuilder sb = new StringBuilder();
		for (String pathPart : pathItems) {
			sb.append("/" + String.valueOf(Math.abs(pathPart.hashCode())));
		}
		// log.info("HASHED PATH: " + sb.toString());
		return sb.toString();
	}

	private void processFile(ZipEntry entry) {
		String name = entry.getName();
		int lastSlashIdx = name.lastIndexOf("/");
		String fileName = name.substring(lastSlashIdx + 1);
		String path = name.substring(0, lastSlashIdx);
		path = hashizePath(path);

		/*
		 * If the path is changing, that means we're on a new node and need to reset
		 * state variables
		 */
		if (curPath == null || !curPath.equals(path)) {
			saveIfPending();
			curNode = null;
			curContent = null;
			curFileName = null;
		}

		curPath = path;
		log.trace("Import FILE Entry: " + entry.getName() + " curPath=" + curPath);

		ByteArrayInputStream bais = null;

		/*
		 * todo-2: This value exists in properties file, and also in TypeScript
		 * variable. Need to have better way to define this ONLY in properties file.
		 */
		int maxFileSize = 20 * 1024 * 1024;
		LimitedInputStreamEx bais2 = null;

		try {
			// JSON FILE
			if (mimeUtil.isJsonFileType(fileName)) {
				log.debug("  isJSON: " + fileName);
				curFileName = fileName;
				String json = IOUtils.toString(zis, "UTF-8");
				curNode = ensureNodeExists(path);
				jsonToNodeService.importJsonContent(json, curNode);
				// if (curNode.getContent()!=null) {
				// curContent = curNode.getContent();
				// }
			}
			// Any other TEXT file
			else if (mimeUtil.isTextTypeFileName(fileName)) {
				log.debug("  isTXT: " + fileName);
				curContent = IOUtils.toString(zis, "UTF-8");
			}
			// Or else treat as binary attachment
			else {
				log.debug("  isBIN: " + fileName);
				curNode = ensureNodeExists(path);
				if (curContent == null) {
					curContent = fileName;
				}

				String mimeType = URLConnection.guessContentTypeFromName(fileName);
				log.debug("  mimeGuessed=" + mimeType);

				/*
				 * todo-p1: this will blow up on large video files for example. Better to use
				 * streaming and not all-in-memory buffer, but i'm not sure if simply the fact
				 * we are unzipping a zip means avoiding holding in memory is doable.
				 */
				byte[] bytes = IOUtils.toByteArray(zis);
				bais = new ByteArrayInputStream(bytes);

				bais2 = new LimitedInputStreamEx(new ByteArrayInputStream(bytes), maxFileSize);

				/* Note: bais stream IS closed inside this method, so we don't close it here */
				attachmentService.attachBinaryFromStream(session, curNode, null, fileName, bytes.length, bais2,
						mimeType, -1, -1, false, false);
			}
		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		} finally {
			StreamUtil.close(bais, bais2);
		}
	}

	/* Saves the current node along with whatver curContent we currently have */
	private void saveIfPending() {
		/*
		 * If we never encountered a metadata content file in the folder, then default
		 * to using the filename we encoutered as the content
		 */
		if (curContent == null && curFileName != null && !(curNode != null && curNode.getContent() != null)) {
			curContent = curFileName;
		}

		if (curNode != null) {
			if (curNode.getContent() == null) {
				curNode.setContent(curContent);
			}
			api.save(session, curNode);
			log.debug("CurNode Saved: " + curNode.getPath());
		}
		curNode = null;
	}
}

