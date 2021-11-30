package org.subnode.service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;
import org.subnode.model.IPFSDirStat;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.PublishNodeToIpfsRequest;
import org.subnode.response.PublishNodeToIpfsResponse;
import org.subnode.util.ExUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;

/**
 * Prototype Bean: We instantiate a new instance of this bean every time it's run.
 * 
 * Writes every node under the target subnode (recursively) to an IPFS Mutable File System (MFS)
 * file, and also removes any existing orphans from underneath the MFS path so that MFS is
 * guaranteed to match the nodes tree perfectly after this operation.
 */
@Component
@Scope("prototype")
public class SyncToIpfsService extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(SyncToIpfsService.class);

	MongoSession session;

	HashSet<String> allNodePaths = new HashSet<>();
	HashSet<String> allFilePaths = new HashSet<>();

	int totalNodes = 0;
	int orphansRemoved = 0;

	/*
	 * Creates MFS files (a folder structure/tree) that are identical in content to the JSON rendering
	 * of each node, and at the same MFS path as the 'pth' property (Node path)
	 */
	public void writeIpfsFiles(MongoSession ms, PublishNodeToIpfsRequest req, PublishNodeToIpfsResponse res) {
		log.debug("writeIpfsFiles: " + XString.prettyPrint(res));
		ms = ThreadLocals.ensure(ms);
		this.session = ms;
		String nodeId = req.getNodeId();
		SubNode node = read.getNode(ms, nodeId);

		boolean success = false;
		try {
			auth.ownerAuth(ms, node);
			Iterable<SubNode> results = read.getSubGraph(ms, node, null, 0);

			processNode(node);
			for (SubNode n : results) {
				processNode(n);
			}

			ipfs.flushFiles(node.getPath());

			// collects all paths into allFilePaths
			ipfs.traverseDir(node.getPath(), allFilePaths);
			removeOrphanFiles();

			IPFSDirStat pathStat = ipfs.pathStat(node.getPath());
			if (pathStat != null) {
				node.set(NodeProp.IPFS_CID.s(), pathStat.getHash());

				Map<String, Object> ipnsMap = ipfs.ipnsPublish(ms, null, pathStat.getHash());
				String name = (String)ipnsMap.get("Name");
				if (name!=null) {
					node.set(NodeProp.IPNS_CID.s(), name);
				}
			}

			success = true;
		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		}

		res.setMessage(buildReport());
		res.setSuccess(success);
	}

	private String buildReport() {
		StringBuilder sb = new StringBuilder();
		sb.append("IPFS Sync complete\n\n");
		sb.append("Total Nodes: " + totalNodes + "\n");
		sb.append("Orphans Deleted: " + orphansRemoved + "\n");
		return sb.toString();
	}

	private void removeOrphanFiles() {
		allFilePaths.forEach(path -> {
			/*
			 * if any file path is not a node path, it needes to be deleted.
			 * 
			 * todo-1: this will run more efficiently if we put path values into a list and then sort that list
			 * ascending by the length of the string, so any parent folders are guaranteed to get deleted before
			 * any of their subfolders (as a convenient consequence of children having to have longer paths than
			 * their parents!) are encountered, and we run therefore the minimal number of deletes required to
			 * accomplish this in every case!
			 */
			if (!allNodePaths.contains(path)) {
				try {
					// to delete the files we really just delete it's parent folder instead, because
					// each node has a decicated folder,
					// and this will delete children first.
					path = XString.stripIfEndsWith(path, "/n.json");
					log.debug("DELETE ORPHAN: " + path);
					ipfs.deletePath(path);
					orphansRemoved++;
				} catch (Exception e) {
					/*
					 * I'm expecting this to fail when it attempts to delete any subfolders under folders that were
					 * already deleted because we may have just deleted their parents already in this same loop so...
					 * 
					 * todo-1: when we delete a folder, scan for all other folders that have that matching prefix and
					 * remove them too, because there's no need to call deleteFile on those.
					 */
				}
			}
		});
	}

	private void processNode(SubNode node) {
		// todo-1: This should be unnecessary but for now we need it.
		snUtil.removeDefaultProps(node);

		snUtil.removeUnwantedPropsForIPFS(node);

		/*
		 * todo-1: this and other places needs to generate canonical JSON (basically just sorted properties
		 * ?) using this??
		 */
		// objectMapper.configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);
		// objectMapper.configure(SerializationFeature.INDENT_OUTPUT, true);
		String json = XString.prettyPrint(node);
		String fileName = node.getPath() + "/n.json";
		log.debug("Sync to IPFS: " + fileName);
		allNodePaths.add(fileName);
		totalNodes++;
		addFile(fileName, json);
	}

	/*
	 * todo-1: there *is* a way to eliminate the need for the 'checkExisting' flag and make it always
	 * true but for now the only way to return a CID even if not existing is to attempt to re-add every
	 * time so we do that for now because it's simpler
	 */
	private void addFile(String fileName, String json) {
		if (json.equals(ipfs.readFile(fileName))) {
			log.debug("not writing. Content was up to date.");
			return;
		}
		addFile(fileName, json.getBytes(StandardCharsets.UTF_8));
	}

	private void addFile(String fileName, byte[] bytes) {
		addEntry(fileName, new ByteArrayInputStream(bytes));
	}

	private void addEntry(String fileName, InputStream stream) {
		ipfs.addFileFromStream(session, fileName, stream, null, null);
	}
}
