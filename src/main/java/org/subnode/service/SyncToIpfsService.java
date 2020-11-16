package org.subnode.service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.PublishNodeToIpfsRequest;
import org.subnode.response.PublishNodeToIpfsResponse;
import org.subnode.util.ExUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;

/* Writes every node under the target subnode (recursively) to an IPFS Mutable File System (MFS) file */
@Component
@Scope("prototype")
public class SyncToIpfsService {
	private static final Logger log = LoggerFactory.getLogger(SyncToIpfsService.class);

	@Autowired
	IPFSService ipfsService;

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoAuth auth;

	MongoSession session;

	HashSet<String> allNodePaths = new HashSet<String>();
	HashSet<String> allFilePaths = new HashSet<String>();

	int totalNodes = 0;
	int orphansRemoved = 0;

	public void writeIpfsFiles(MongoSession session, PublishNodeToIpfsRequest req,
			final PublishNodeToIpfsResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		this.session = session;
		final String nodeId = req.getNodeId();
		final SubNode node = read.getNode(session, nodeId);

		boolean success = false;
		try {
			auth.authRequireOwnerOfNode(session, node);
			Iterable<SubNode> results = read.getSubGraph(session, node);

			processNode(node);
			for (SubNode n : results) {
				processNode(n);
			}

			ipfsService.flushFiles(node.getPath());
			ipfsService.dumpDir(node.getPath(), allFilePaths);
			removeOrphanFiles();

			success = true;
		} catch (

		final Exception ex) {
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

			// if any file path is not a node path, it needes to be deleted.
			// todo-0: this will run more efficiently if we put path values into a list and
			// then sort that list
			// ascending by the length of the string, so any parent folders are guaranteed
			// to get deleted before any of
			// their subfolders are encountered, and we run therefore the minimal number of
			// deletes required to accomplish this
			// in every case! Genius!
			if (!allNodePaths.contains(path)) {
				try {
					// to delete the files we really just delete it's parent folder instead, because
					// each node has a decicated folder,
					// and this will delete children first.
					path = XString.stripIfEndsWith(path, "/node.json");
					log.debug("DELETE ORPHAN: " + path);
					ipfsService.deletePath(path);
					orphansRemoved++;
				} catch (Exception e) {
					// I'm expecting this to fail when it attempts to delete any subfolders under
					// folders
					// that were already deleted because we may have just deleted their parents
					// already in this same loop
					// so...
					// todo-0: when we delete a folder, scan for all other folders that have that
					// matching prefix
					// and remove them too, because there's no need to call deleteFile on those.
				}
			}
		});
	}

	private void processNode(SubNode node) {
		log.debug("IPFS FILE: " + node.getPath() + " [" + node.getId() + "]");

		// todo-0: this and other places needs to generate canonical JSON (basically
		// just sorted properties ?)
		// using this??
		// objectMapper.configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);
		// objectMapper.configure(SerializationFeature.INDENT_OUTPUT, true);
		String json = XString.prettyPrint(node);
		String fileName = node.getPath() + "/node.json";
		allNodePaths.add(fileName);
		totalNodes++;
		addFile(fileName, json);
	}

	private void addFile(String fileName, String content) {
		if (content.equals(ipfsService.readFile(fileName))) {
			// log.debug("not writing. Content was up to date.");
			return;
		}
		addFile(fileName, content.getBytes(StandardCharsets.UTF_8));
	}

	private void addFile(String fileName, byte[] bytes) {
		addEntry(fileName, new ByteArrayInputStream(bytes));
	}

	private void addEntry(String fileName, InputStream stream) {
		ipfsService.addFileFromStream(session, fileName, stream, null, null, null);
	}
}