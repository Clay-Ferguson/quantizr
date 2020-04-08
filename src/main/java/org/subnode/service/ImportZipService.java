package org.subnode.service;

import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.StringTokenizer;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.subnode.config.SessionContext;
import org.subnode.config.SpringContextUtil;
import org.subnode.model.UserPreferences;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.Const;
import org.subnode.util.ExUtil;
import org.subnode.util.LimitedInputStreamEx;
import org.subnode.util.MimeUtil;
import org.subnode.util.StreamUtil;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.Util;
import org.subnode.util.XString;
import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipArchiveInputStream;
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

	private static final ObjectMapper jsonMapper = new ObjectMapper();

	/*
	 * This is used to detect if this 'prototype scope' object might have been
	 * autowired, and is getting called for a second time which is NOT supported.
	 * Each use of this object requires a new instance of it.
	 */
	private boolean used;

	@Autowired
	private MongoApi api;

	@Autowired
	private AttachmentService attachmentService;

	@Autowired
	private MimeUtil mimeUtil;

	@Autowired
	private SessionContext sessionContext;

	private String targetPath;

	private ZipArchiveInputStream zis;
	private MongoSession session;

	private SubNode importRootNode;

	/* Maps the 'bin' properties of nodes to the associates SubNode */
	private HashMap<String, SubNode> binToNodeMap = new HashMap<String, SubNode>();

	/*
	 * imports the file directly from an internal resource file (classpath resource,
	 * built into WAR file itself)
	 */
	public SubNode inputZipFileFromResource(MongoSession session, String resourceName, SubNode node, String nodeName) {

		Resource resource = SpringContextUtil.getApplicationContext().getResource(resourceName);
		InputStream is = null;
		SubNode rootNode = null;
		try {
			is = resource.getInputStream();
			rootNode = importZipFileFromStream(session, is, node, true);
		} catch (Exception e) {
			throw ExUtil.newEx(e);
		} finally {
			StreamUtil.close(is);
		}

		log.debug("Finished Input From Zip file.");
		api.saveSession(session);
		return rootNode;
	}

	/* Returns the first node created which is always the root of the import */
	public SubNode importZipFileFromStream(MongoSession session, InputStream is, SubNode node,
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

			zis = new ZipArchiveInputStream(is);
			ZipArchiveEntry entry;
			while ((entry = zis.getNextZipEntry()) != null) {
				if (!entry.isDirectory()) {
					processFile(entry);
				}
			}

		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		} finally {
			StreamUtil.close(zis);
		}
		return importRootNode;
	}

	private String hashizePath(String path) {
		List<String> pathItems = XString.tokenize(path, "/", true);
		StringBuilder sb = new StringBuilder();
		for (String pathPart : pathItems) {
			/*
			 * todo-1: It would be better if we had a way to make the actual path parts
			 * match the hash of the node ID which is the normal standard because generating
			 * the hash here like this is *safe* but is kind of the equivalent of 'naming'
			 * the node, becasue the node can also have any name, and this is like naming it
			 * the hash we generate here.
			 */
			String p = Util.getHashOfString(pathPart, SubNodeUtil.PATH_HASH_LEN);
			sb.append("/" + p);
		}
		// log.info("HASHED PATH: " + sb.toString());
		return sb.toString();
	}

	private void processFile(ZipArchiveEntry entry) {
		String name = entry.getName();
		int lastSlashIdx = name.lastIndexOf("/");
		String fileName = name.substring(lastSlashIdx + 1);
		String path = name.substring(0, lastSlashIdx);
		path = hashizePath(path);

		log.trace("Import FILE Entry: " + entry.getName());
		try {
			// JSON FILE
			if (mimeUtil.isHtmlTypeFileName(fileName)) {
				// log.debug(" isHTML: " + fileName);
				// we ignore the html files during import. Data will be in JSON files
			} else if (mimeUtil.isJsonFileType(fileName)) {
				log.debug("  isJSON: " + fileName);
				String json = IOUtils.toString(zis, "UTF-8");
				SubNode node = jsonMapper.readValue(json, SubNode.class);

				node.setPath(targetPath + node.getPath());

				String bin = node.getStringProp(NodeProp.BIN.s());
				if (bin != null) {
					binToNodeMap.put(bin, node);
				}
			}
			// Any other TEXT file
			else if (mimeUtil.isTextTypeFileName(fileName)) {
				// log.debug(" isTXT: " + fileName);
				// curContent = IOUtils.toString(zis, "UTF-8");
			}
			// Or else treat as binary attachment
			else {
				log.debug("  isBIN: " + fileName);
				storeBinary(entry);
			}
		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	/*
	 * Note the fileame will be either 'ipfs-[ipfsHash]-filename.ext' or
	 * '[gridId]-filename.ext' , depending on if the binary is an IPFS-persisted
	 * data file or not
	 */
	private void storeBinary(ZipArchiveEntry entry) {
		String name = entry.getName();
		int lastSlashIdx = name.lastIndexOf("/");
		String fileName = name.substring(lastSlashIdx + 1);
		StringTokenizer t = new StringTokenizer(fileName, "-", false);
		SubNode node = null;

		while (t.hasMoreTokens()) {
			String tok = t.nextToken().trim();
			if (tok.equals("ipfs")) {
				return;
			} else {
				node = binToNodeMap.get(tok);
				if (node != null) {
					// log.debug("Found owner for binary as id=" + node.getId().toHexString());
					break;
				}
				break;
			}
		}

		if (node != null) {
			Long length = node.getIntProp(NodeProp.BIN_SIZE.s());
			String mimeType = node.getStringProp(NodeProp.BIN_MIME.s());

			int maxFileSize = Const.DEFAULT_MAX_FILE_SIZE;
			LimitedInputStreamEx lzis = new LimitedInputStreamEx(zis, maxFileSize);
			attachmentService.attachBinaryFromStream(session, node, null, fileName, length, lzis, mimeType, -1, -1,
					false, false, false, true, false, false);
		}
	}
}
