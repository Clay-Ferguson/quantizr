package org.subnode.service;

import java.io.InputStream;
import java.util.HashMap;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.apache.commons.compress.archivers.ArchiveEntry;
import org.apache.commons.io.IOUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.subnode.config.SessionContext;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.ExUtil;
import org.subnode.util.FileUtils;
import org.subnode.util.LimitedInputStreamEx;
import org.subnode.util.MimeUtil;

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
	public MongoUtil mongoUtil;

	@Autowired
	public MongoUpdate update;

	@Autowired
	public MongoRead read;

	@Autowired
	public AttachmentService attachmentService;

	@Autowired
	public MimeUtil mimeUtil;

	@Autowired
	public SessionContext sessionContext;

	@Autowired
	public FileUtils fileUtils;

	public String targetPath;

	public MongoSession session;

	public SubNode importRootNode;

	public HashMap<String, String> oldIdToNewIdMap = new HashMap<String, String>();

	public void processFile(ArchiveEntry entry, InputStream zis, ObjectId ownerId) {
		String name = entry.getName();
		int lastSlashIdx = name.lastIndexOf("/");
		String fileName = lastSlashIdx == -1 ? name : name.substring(lastSlashIdx + 1);

		log.trace("Import FILE Entry: " + entry.getName());
		try {
			// JSON FILE
			if (mimeUtil.isHtmlTypeFileName(fileName)) {
				// log.debug(" isHTML: " + fileName);
				// we ignore the html files during import. Data will be in JSON files
			} else if (mimeUtil.isJsonFileType(fileName)) {
				log.debug("  isJSON: " + fileName);
				String json = IOUtils.toString(zis, "UTF-8");
				//log.debug("  JSON STRING: " + json);
				SubNode node = jsonMapper.readValue(json, SubNode.class);

				//log.debug("   from JAVA:" + XString.prettyPrint(node));

				node.setPath(targetPath + node.getPath());
				String oldId = node.getId().toHexString();

				/*
				 * delete the BIN prop now, because it will have to be added during this import,
				 * and the existing BIN id will no longer apply
				 */
				node.deleteProp(NodeProp.BIN.s());

				// nullify name because we don't want to blow up indexes
				node.setName(null);

				// we must nullify the node ID so that it creates a new node when saved.
				node.setId(null);
				node.setOwner(ownerId);
				update.save(session, node);

				oldIdToNewIdMap.put(oldId, node.getId().toHexString());
			}
			// Any other TEXT file
			else if (mimeUtil.isTextTypeFileName(fileName)) {
				// log.debug(" isTXT: " + fileName);
				// curContent = IOUtils.toString(zis, "UTF-8");
			}
			// Or else treat as binary attachment
			else {
				/*
				 * check fo a slash in name to avoide any of our root files, which for the HTML
				 * viewing only (of exploded jars)
				 */
				if (lastSlashIdx != -1) {
					log.debug("  isBIN: " + fileName);
					storeBinary(entry, zis, fileName);
				}
			}
		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		}
	}

	/*
	 * The part of the file name not including the extension will be the actual
	 * nodeId of the node onto which we need to attach the binary after translating
	 * thru oldIdToNewIdMap however!
	 */
	public void storeBinary(ArchiveEntry entry, InputStream zis, String fileName) {
		String nodeId = fileUtils.stripExtension(fileName);
		/*
		 * todo-1: need to retest whether an export actually INCLUDES IPFS file data or
		 * just maintains a link to the IPFS data? This really needs to be an export
		 * option that the user can specify, because it would be nice if there WERE a
		 * way for an export to extract data out of IPFS and save it in the exported
		 * file
		 */
		nodeId = oldIdToNewIdMap.get(nodeId);

		if (nodeId != null) {
			SubNode node = read.getNode(session, nodeId);
			if (node == null) {
				throw new RuntimeEx("Unable to find node by id: " + nodeId);
			}
			Long length = node.getIntProp(NodeProp.BIN_SIZE.s());
			String mimeType = node.getStringProp(NodeProp.BIN_MIME.s());
			LimitedInputStreamEx lzis = new LimitedInputStreamEx(zis, Integer.MAX_VALUE);

			// log.debug("Attaching binary to nodeId: " + node.getId().toHexString());
			attachmentService.attachBinaryFromStream(session, "", node, null, fileName, length, lzis, mimeType, -1, -1,
					false, false, false, true, false, false);
		} else {
			// this is normal to get here and indicates this file is NOT an attachment file.
		}
	}
}
