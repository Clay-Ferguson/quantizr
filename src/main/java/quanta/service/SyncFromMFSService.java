package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.HashSet;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.model.client.NodeProp;
import quanta.model.ipfs.dag.MerkleLink;
import quanta.model.ipfs.dag.MerkleNode;
import quanta.model.ipfs.file.IPFSDir;
import quanta.model.ipfs.file.IPFSDirEntry;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.mongo.model.SubNodeIdentity;
import quanta.mongo.model.SubNodePojo;
import quanta.request.LoadNodeFromIpfsRequest;
import quanta.response.LoadNodeFromIpfsResponse;
import quanta.util.ExUtil;
import quanta.util.ThreadLocals;
import quanta.util.XString;

/* Does the reverse of SyntToMFSService */
@Component
@Scope("prototype")
public class SyncFromMFSService extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(SyncFromMFSService.class);

	public static final ObjectMapper jsonMapper = new ObjectMapper();
	{
		jsonMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
	}

	int failedFiles = 0;
	int matchingFiles = 0;
	int createdFiles = 0;

	MongoSession session;

	HashSet<String> allNodePaths = new HashSet<>();
	HashSet<String> allFilePaths = new HashSet<>();

	int totalNodes = 0;
	int orphansRemoved = 0;

	/**
	 * NOTE: req.path can be a path or CID. Path must of course be a LOCAL path, and is assumed if the
	 * string starts with '/', otherwise is treated as a CID.
	 *
	 * todo-2: currently this is an inefficient AND imcomplete algo, and needs these two enhancements:
	 * 
	 * 1) Do a subGraph query at the root first (req.getPath()) and build up a HashSet of all IDs, then
	 * use that to know which nodes already do exist, as a performance aid.
	 * 
	 * 2) Then at the end any of those that are NOT in the HashSet of all the node IDs that came from
	 * IPFS file scanning are known to be orphans to be removed.
	 * 
	 * So, for now, this algo will be slow, and will leave orphans around after pulling in from ipfs.
	 * (orphans meaning those nodes didn't exist in the ipfs files)
	 */
	public void writeNodes(MongoSession ms, LoadNodeFromIpfsRequest req, LoadNodeFromIpfsResponse res) {
		ms = ThreadLocals.ensure(ms);
		this.session = ms;

		try {
			// if the path is a CID we load from CID however this flow path was never perfected/finised and was
			// only ever a partially complete experiment
			if (!req.getPath().startsWith("/")) {
				if (traverseDag(null, req.getPath(), 3)) {
					res.setMessage(buildReport());
					res.setSuccess(true);
				} else {
					res.setMessage("Unable to process: " + req.getPath());
					res.setSuccess(false);
				}
			}
			// Loading from an actual MFS path was completed, but is not very usable becasue we can only
			// access data from the local MFS
			else {
				if (processPath(req.getPath())) {
					res.setMessage(buildReport());
					res.setSuccess(true);
				} else {
					res.setMessage("Unable to process: " + req.getPath());
					res.setSuccess(false);
				}
			}
		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		}
	}

	public boolean loadNode(MongoSession ms, SubNode node) {
		String cid = node.getStr(NodeProp.IPFS_SCID);
		traverseDag(node, cid, 1);
		return true;
	}

	/*
	 * WORK IN PROGRESS: This code will be the core of how we can have an IPFS explorer capability that
	 * can explore a DAG.
	 * 
	 * recursive will be the number of depth levels left allowed
	 */
	public boolean traverseDag(SubNode node, String cid, int recursive) {
		boolean success = false;
		MerkleNode dag = ipfsDag.getNode(cid);
		if (ok(dag)) {
			log.debug("Dag Dir: " + XString.prettyPrint(dag));

			if (no(dag.getLinks())) {
				return success;
			}

			for (MerkleLink entry : dag.getLinks()) {
				String entryCid = entry.getCid().getPath();

				/*
				 * we rely on the logic of "if not a json file, it's a folder
				 */
				if (!entry.getName().endsWith(".json")) {
					if (recursive > 0) {

						// WARNING. This codee is Incomplete: Left off working here: Need to create newNode as a child of 'node', and put the
						// entry.getCid.getPath() onto it's 'ipfs:scid' (make it explorable), and for now we could either
						// just put it's CID also in as the text for it, or else actually read the text-content from the
						// JSON
						// (But we'd need to first query all subnodes under 'node' so we can be sure not to recreate any
						// duplidate nodes in case this scid already exists).
						// Also once we DO load a level we'd need to set a flag on the node to indicate we DID read it
						// and to avoid attempting to traverse any node that's already fully loaded.
						SubNode newNode = null;

						traverseDag(newNode, entry.getCid().getPath(), recursive - 1);
					}
				} else {
					// read the node json from ipfs file
					String json = ipfsCat.getString(entryCid);
					if (no(json)) {
						log.debug("fileReadFailed: " + entryCid);
						failedFiles++;
					} else {
						log.debug("json: " + json);

						try {
							SubNodePojo nodePojo = jsonMapper.readValue(json, SubNodePojo.class);
							log.debug("nodePojo Parsed: " + XString.prettyPrint(nodePojo));
							// update.save(session, nodePojo);
							log.debug("Created Node: " + nodePojo.getId());
						} catch (Exception e) {
							// todo
						}
					}
				}
			}
			success = true;
		}
		return success;
	}

	public boolean processPath(String path) {
		boolean success = false;
		log.debug("processDir: " + path);

		IPFSDir dir = ipfsFiles.getDir(path);
		if (ok(dir)) {
			log.debug("Dir: " + XString.prettyPrint(dir));

			if (no(dir.getEntries())) {
				return success;
			}

			for (IPFSDirEntry entry : dir.getEntries()) {
				String entryPath = path + "/" + entry.getName();

				if (entry.getSize() == 0) {
					processPath(entryPath);
				}
				// else process a file
				else {
					/*
					 * we rely on the logic of "if not a json file, it's a folder
					 */
					if (!entry.getName().endsWith(".json")) {
						processPath(entryPath);
					} else {
						log.debug("processFile: " + entryPath);

						// read the node json from ipfs file
						String json = ipfsFiles.readFile(entryPath);
						if (no(json)) {
							log.debug("fileReadFailed: " + entryPath);
							failedFiles++;
						} else {
							// we found the ipfs file json, so convert it to SubNode, and save
							SubNodeIdentity node = null;
							try {
								/*
								 * UPDATE: Now that we have SubNodePojo.java for deseralizing we no longer need SubNodeIdentity
								 * and we can refactor it out.
								 * 
								 * todo-2: WARNING! Simply deserializing a SubNode object causes it to become a REAL node and
								 * behave as if it were inserted into the DB, so that after json parses it 'read.getNode()' Mongo
								 * query will immediately find it and 'claim' that it's been inserted into the DB already.
								 * 
								 * Solution: I created SubNodeIdentity to perform a pure (partial) deserialization, but I need to
								 * check the rest of the codebase to be sure there's nowhere that this surprise will break things.
								 * (import/export logic?)
								 */
								node = jsonMapper.readValue(json, SubNodeIdentity.class);

								// we assume the node.id values can be the same across Federated instances.
								SubNode findNode = read.getNode(session, node.getId());
								if (ok(findNode)) {
									log.debug("Node existed: " + node.getId());
									matchingFiles++;
									// todo-2: check if node is same content here.
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
