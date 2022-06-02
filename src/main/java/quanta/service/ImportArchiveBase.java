package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.io.InputStream;
import java.util.HashMap;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.compress.archivers.ArchiveEntry;
import org.apache.commons.io.IOUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.client.NodeProp;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.util.ExUtil;
import quanta.util.LimitedInputStreamEx;
import quanta.util.Val;
import quanta.util.XString;

public abstract class ImportArchiveBase extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(ImportArchiveBase.class);

	public static final ObjectMapper jsonMapper = new ObjectMapper();

	/*
	 * This is used to detect if this 'prototype scope' object might have been autowired, and is getting
	 * called for a second time which is NOT supported. Each use of this object requires a new instance
	 * of it.
	 */
	public boolean used;

	public String targetPath;
	public MongoSession session;
	public SubNode importRootNode;
	public HashMap<String, String> oldIdToNewIdMap = new HashMap<>();

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
				// log.debug(" JSON STRING: " + json);

				Val<String> oldId = new Val<>();

				// run unmarshalling as admin (otherwise setPath can bark about user being not same as owner)
				SubNode node = (SubNode) arun.run(ms -> {
					try {
						SubNode n = jsonMapper.readValue(json, SubNode.class);

						String newPath = mongoUtil.findAvailablePath(targetPath + n.getPath());
						n.setPath(newPath);
						oldId.setVal(n.getIdStr());

						/*
						 * delete the BIN prop now, because it will have to be added during this import, and the existing
						 * BIN id will no longer apply
						 */
						n.delete(NodeProp.BIN);

						// nullify name because we don't want to blow up indexes
						n.setName(null);

						// we must nullify the node ID so that it creates a new node when saved.
						n.setId(null);
						n.setOwner(ownerId);
						log.debug("IMPORT NODE: " + XString.prettyPrint(n));
						return n;
					} catch (Exception e) {
						log.error("Failed unmarshalling node: " + json);
						return null;
					}
				});

				if (no(node)) {
					throw new RuntimeException("import unmarshalling failed.");
				}

				update.save(session, node);
				oldIdToNewIdMap.put(oldId.getVal(), node.getIdStr());
			}
			// Any other TEXT file
			else if (mimeUtil.isTextTypeFileName(fileName)) {
				// log.debug(" isTXT: " + fileName);
				// curContent = IOUtils.toString(zis, "UTF-8");
			}
			// Or else treat as binary attachment
			else {
				/*
				 * check fo a slash in name to avoide any of our root files, which for the HTML viewing only (of
				 * exploded jars)
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
	 * The part of the file name not including the extension will be the actual nodeId of the node onto
	 * which we need to attach the binary after translating thru oldIdToNewIdMap however!
	 */
	public void storeBinary(ArchiveEntry entry, InputStream zis, String fileName) {
		String nodeId = fileUtil.stripExtension(fileName);
		/*
		 * todo-2: it would be nice if there WERE a way for an export to extract data out of IPFS and save
		 * it in the exported file
		 */
		nodeId = oldIdToNewIdMap.get(nodeId);

		if (ok(nodeId)) {
			SubNode node = read.getNode(session, nodeId);
			if (no(node)) {
				throw new RuntimeEx("Unable to find node by id: " + nodeId);
			}
			Long length = node.getInt(NodeProp.BIN_SIZE);
			String mimeType = node.getStr(NodeProp.BIN_MIME);
			LimitedInputStreamEx lzis = new LimitedInputStreamEx(zis, Integer.MAX_VALUE);

			// log.debug("Attaching binary to nodeId: " + node.getIdStr());
			attach.attachBinaryFromStream(session, "", node, null, fileName, length, lzis, mimeType, -1, -1, false, false, false,
					true, false, false, true, null);
		} else {
			// this is normal to get here and indicates this file is NOT an attachment file.
		}
	}
}
