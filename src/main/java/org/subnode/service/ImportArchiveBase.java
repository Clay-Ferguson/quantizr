package org.subnode.service;

import java.io.InputStream;
import java.util.List;

import org.subnode.model.client.NodeProp;
import org.subnode.config.SessionContext;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoThreadLocal;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.Const;
import org.subnode.util.ExUtil;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.XString;

import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import java.util.HashMap;
import java.util.StringTokenizer;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.subnode.util.LimitedInputStreamEx;
import org.subnode.util.MimeUtil;
import org.subnode.util.Util;
import org.apache.commons.compress.archivers.ArchiveEntry;

public abstract class ImportArchiveBase {
	private static final Logger log = LoggerFactory.getLogger(ImportArchiveBase.class);

	public static final ObjectMapper jsonMapper = new ObjectMapper();

	/*
	 * This is used to detect if this 'prototype scope' object might have been
	 * autowired, and is getting called for a second time which is NOT supported.
	 * Each use of this object requires a new instance of it.
	 */
	public boolean used;

	@Autowired
	public MongoApi api;

	@Autowired
	public AttachmentService attachmentService;

	@Autowired
	public MimeUtil mimeUtil;

	@Autowired
	public SessionContext sessionContext;

	public String targetPath;

	public MongoSession session;

	public SubNode importRootNode;

	public HashMap<String, String> oldIdToNewIdMap = new HashMap<String, String>();

	public void processFile(ArchiveEntry entry, InputStream zis) {
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
				String oldId = node.getId().toHexString();

				// delete the BIN prop now, because it will have to be added during this import,
				// and the existing BIN id will
				// no longer apply
				node.deleteProp(NodeProp.BIN.s());

				// we must nullify the node ID so that it creates a new node when saved.
				node.setId(null);
				api.save(session, node);

				oldIdToNewIdMap.put(oldId, node.getId().toHexString());
			}
			// Any other TEXT file
			else if (mimeUtil.isTextTypeFileName(fileName)) {
				// log.debug(" isTXT: " + fileName);
				// curContent = IOUtils.toString(zis, "UTF-8");
			}
			// Or else treat as binary attachment
			else {
				log.debug("  isBIN: " + fileName);
				storeBinary(entry, zis);
			}
		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		}
	}

	/*
	 * Note the fileame will be either 'ipfs-[ipfsHash]-filename.ext' or
	 * '[gridId]-filename.ext' , depending on if the binary is an IPFS-persisted
	 * data file or not
	 */
	public void storeBinary(ArchiveEntry entry, InputStream zis) {
		String name = entry.getName();
		int lastSlashIdx = name.lastIndexOf("/");
		String fileName = name.substring(lastSlashIdx + 1);
		StringTokenizer t = new StringTokenizer(fileName, "-", false);
		String nodeId = null;
		while (t.hasMoreTokens()) {
			String tok = t.nextToken().trim();
			if (tok.equals("ipfs")) {
				return;
			} else {
				/*
				 * NOTE: For this lookup to work, we're requiring the JSON file to be ahead of
				 * the binary attachment in the actual zip stream, which may be problematic if
				 * we ever try to import 'user generted' files that may have the correct format
				 * but weren't exported by the platform.
				 */
				nodeId = oldIdToNewIdMap.get(tok);
				if (nodeId != null) {
					log.debug("Found owner for binary as id=" + nodeId);
					break;
				}
				break;
			}
		}

		if (nodeId != null) {
			SubNode node = api.getNode(session, nodeId);
			if (node == null) {
				throw new RuntimeEx("Unable to find node by id: " + nodeId);
			}
			Long length = node.getIntProp(NodeProp.BIN_SIZE.s());
			String mimeType = node.getStringProp(NodeProp.BIN_MIME.s());

			int maxFileSize = session.getMaxUploadSize();
			LimitedInputStreamEx lzis = new LimitedInputStreamEx(zis, maxFileSize);
			log.debug("Attaching binary to nodeId: "+node.getId().toHexString());
			attachmentService.attachBinaryFromStream(session, node, null, fileName, length, lzis, mimeType, -1, -1,
					false, false, false, true, false, false);
		} else {
			// this is normal to get here and indicates this file is NOT an attachment file.
		}
	}

	public String hashizePath(String path) {
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

}
