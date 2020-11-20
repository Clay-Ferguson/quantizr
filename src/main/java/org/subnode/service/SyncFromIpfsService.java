package org.subnode.service;

import java.util.HashSet;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;
import org.subnode.model.IPFSDir;
import org.subnode.model.IPFSDirEntry;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.model.SubNode;
import org.subnode.mongo.model.SubNodeIdentity;
import org.subnode.request.LoadNodeFromIpfsRequest;
import org.subnode.response.LoadNodeFromIpfsResponse;
import org.subnode.util.ExUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;

/* Writes every node under the target subnode (recursively) to an IPFS Mutable File System (MFS) file */
@Component
@Scope("prototype")
public class SyncFromIpfsService {
	private static final Logger log = LoggerFactory.getLogger(SyncFromIpfsService.class);

	public static final ObjectMapper jsonMapper = new ObjectMapper();
	{
		jsonMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
	}

	@Autowired
	IPFSService ipfsService;

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoUpdate update;

	@Autowired
	private MongoAuth auth;

	int failedFiles = 0;
	int matchingFiles = 0;
	int createdFiles = 0;

	MongoSession session;

	HashSet<String> allNodePaths = new HashSet<String>();
	HashSet<String> allFilePaths = new HashSet<String>();

	int totalNodes = 0;
	int orphansRemoved = 0;

	/*
	 * todo-0: currently this is an inefficient AND imcomplete algo, and needs these
	 * two enhancements:
	 * 
	 * do a subGraph query of mongo at the root first (req.getPath()) and build up a
	 * HashSet of all IDs, then use that to know which nodes already do exist, as a
	 * performance aid. Then at the end any of those that are NOT in the HashSet of
	 * all the node IDs that came from IPFS file scanning are known to be orphans to
	 * be removed.
	 * 
	 * So, for now, this algo will be slow, and will leave orphans around after
	 * pulling in from ipfs. (orphans meaning those nodes didn't exist in the ipfs
	 * files)
	 */
	public void writeNodes(MongoSession session, LoadNodeFromIpfsRequest req, final LoadNodeFromIpfsResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		this.session = session;

		try {
			if (processPath(req.getPath())) {
				res.setMessage(buildReport());
				res.setSuccess(true);
			} else {
				res.setMessage("Unable to process: "+req.getPath());
				res.setSuccess(false);
			}
		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		}
	}

	// todo-0: put catch block in here so any one file can fail and not blow up the
	// entire process.
	public boolean processPath(String path) {
		boolean success = false;
		log.debug("dumpDir: " + path);
		IPFSDir dir = ipfsService.getDir(path);
		if (dir != null) {
			log.debug("Dir: " + XString.prettyPrint(dir));

			for (IPFSDirEntry entry : dir.getEntries()) {
				/*
				 * as a workaround to the IPFS bug, we rely on the logic of "if not a json file,
				 * it's a folder
				 */
				if (!entry.getName().endsWith(".json")) {
					processPath(path + "/" + entry.getName());
				} else {
					String fileName = path + "/" + entry.getName();
					log.debug("processFile: " + fileName);

					// read the node json from ipfs file
					String json = ipfsService.readFile(fileName);
					if (json == null) {
						log.debug("fileReadFailed: " + fileName);
						failedFiles++;
					} else {
						// we found the ipfs file json, so convert it to SubNode, and save
						SubNodeIdentity node = null;
						try {
							// todo-0: WOW. Simply deserializing a SubNode object causes it to become a REAL
							// node and behave as if
							// it were inserted into the DB, so that after json parses it even the
							// 'read.getNode()' Mongo query will
							// find it and 'claim' that it's been inserted into the DB already. WTF.
							// Solution: I created SubNodeIdentity to perform a pure (partial)
							// deserialization, but I need to check the
							// rest of the codebase to be sure there's nowhere that this surprise will break
							// things. (import/export logic?)
							node = jsonMapper.readValue(json, SubNodeIdentity.class);

							// we assume the node.id values can be the same across Federated instances.
							SubNode findNode = read.getNode(session, node.getId());
							if (findNode != null) {
								log.debug("Node existed: " + node.getId());
								matchingFiles++;
								// todo-0: check if node is same content here.
							} else {
								SubNode realNode = jsonMapper.readValue(json, SubNode.class);
								update.save(session, realNode);
								log.debug("Created Node: " + node.getId());
								createdFiles++;
							}
						} catch (Exception e) {
							failedFiles++;
							log.error("Failed parsing json: " + json, e);
						}
					}
				}
			}
			success = true;
		}
		return success;
	}

	private String buildReport() {
		StringBuilder sb = new StringBuilder();
		sb.append("Matching Files: " + matchingFiles + "\n");
		sb.append("Created Files: " + createdFiles + "\n");
		sb.append("Failed Files: " + failedFiles + "\n");
		return sb.toString();
	}
}