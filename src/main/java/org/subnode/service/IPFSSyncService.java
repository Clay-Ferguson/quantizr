package org.subnode.service;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.subnode.config.NodePrincipal;
import org.subnode.config.NodeProp;
import org.subnode.model.MerkleDAGSyncStats;
import org.subnode.model.MerkleLink;
import org.subnode.model.MerkleNode;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.mongo.model.types.AllSubNodeTypes;
import org.subnode.util.FileUtils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * todo-0: after refactor how is node.getContent being exported? haven't done it yet.
 * 
 * Syncs content into SubNode (i.e. MongoDB) from an IPFS node (and it's
 * chilren, etc), so that SubNode can be used to browse, search, and sort
 * information on the IPFS Web. You can think of this as MongoDB being a 'cache'
 * of IPFS content, where we just let this cache grow forever if we want. It
 * also means we can extremely efficiently serve IPFS information to browsers,
 * becasue we have the power of MongoDB (and Lucene Search) to be able to
 * retrieve the information, rather than relying on the GO implementation of
 * IPFS to provide those layers of capability/performance.
 * 
 * Perhaps a more clear explanation of this is that it's an IPFS "Crawler", that
 * first gets the IPFS data and puts it into our local MongoDB, from where it
 * then behaves as all other content inside SubNode/MongoDB and is searchable,
 * and browsable, like a folder structure. Also the fact that we can Crawl and
 * index as much information as we want, in this way, it opens up SubNode to be
 * used as a powerful "Search Engine", for as much of the IPFS web as we want to
 * index. Currently SubNode cannot just arbitrarily index the IPFS web fully yet
 * in this way but there are almost no technical challenges at all involved in
 * getting that done
 * 
 * NOTE: This code is originally being copied from the pre-existing
 * FileSyncService.java which is essentially the same kind of functionality but
 * for plain server-side File System access.
 * 
 */
@Component
public class IPFSSyncService {
	private static final Logger log = LoggerFactory.getLogger(IPFSSyncService.class);

	@Autowired
	private MongoApi api;

	@Autowired
	private AttachmentService attachmentService;

	@Autowired
	private AllSubNodeTypes TYPES;

	@Autowired
	private IPFSService ipfs;

	@Autowired
	private FileUtils fileUtils;

	/*
	 * Main entry point to perform a sync of 'node' against IPFS. The forceRefresh
	 * theoretically never needs to be true and the main point of it would be if we
	 * for some reason do want to forcably re-read information from the IPFS Web.
	 */
	public void syncNode(MongoSession session, SubNode node, boolean recursive, MerkleDAGSyncStats stats,
			boolean forceRefresh) {

		Objects.requireNonNull(node);

		/*
		 * If this node has already been loaded from IPFS, return. Nothing to do here.
		 * We know that once we have IPFS_OK property set on any give node, that it's
		 * already up to date and we don't need to read again, because IPFS data is
		 * content-addressed and therefore immutable
		 */
		if (!forceRefresh && node.getBooleanProp(NodeProp.IPFS_OK)) {
			log.debug("IPFS: node already loaded into mongo: " + node.getId());
			return;
		} else {
			log.debug("NODE: nodeId=" + node.getId() + " will be read from IPFS network.");
		}

		/*
		 * IPFS_LINK nodes must be owned by 'admin' in order to be allowed to function.
		 * This is only because we currently aren't making any IPFS functionality
		 * available to all users during it's early development
		 */
		// todo-2: Don't we have a dedicated exception for this?
		if (!NodePrincipal.ADMIN.equals(api.getNodeOwner(session, node))) {
			throw new RuntimeException("unauthorized");
		}

		if (!isSyncableNode(session, node)) {
			throw new RuntimeException("Not a syncable node.");
		}

		if (stats == null) {
			stats = new MerkleDAGSyncStats();
		}

		/* Do the actual sync of the IPFS node */
		processSync(session, node, recursive, 0, stats, forceRefresh);
	}

	/**
	 * Innermost and recursive internal method for syncing a node to IPFS
	 */
	private void processSync(MongoSession session, SubNode node, boolean recursive, int level, MerkleDAGSyncStats stats,
			boolean forceRefresh) {
		if (node == null) {
			return;
		}

		String hash = node.getStringProp(TYPES.IPFS_LINK);

		log.debug("Syncing IPFS Node [LEVEL=" + String.valueOf(level) + "]: " + node.getPath() + " to hash: " + hash);

		MerkleNode merkNode = ipfs.getMerkleNode(hash, "json");
		int linkCount = merkNode.getLinks() != null ? merkNode.getLinks().size() : 0;
		log.debug("    linkcount=" + linkCount);

		String content = node.getContent();
		String merkContent = ipfs.objectCat(hash);

		if (merkContent != null) {
			/* Save this property if it has changed */
			if (!merkContent.equals(content)) {
				node.setContent(merkContent);
				node.setProp("sn:contentType", merkNode.getContentType());
				node.setProp(NodeProp.IPFS_OK, true);
				api.save(session, node);
			}
		} else {
			node.setContent("");
			node.setProp(NodeProp.IPFS_OK, true);
			api.save(session, node);
		}

		/* build up a hashmap of all the node objects keyed by hash string */
		HashMap<String, MerkleLink> merkleNodeMap = new HashMap<String, MerkleLink>();

		/* Load map of what hashes exist on the chilren */
		if (merkNode.getLinks() != null) {
			for (MerkleLink link : merkNode.getLinks()) {
				log.debug("    childHash: " + link.getHash());
				merkleNodeMap.put(link.getHash(), link);
			}
		}

		HashMap<String, SubNode> nodeMap = new HashMap<String, SubNode>();
		List<SubNode> nodesToDelete = new LinkedList<SubNode>();

		/* Get iterator for all children under 'node' */
		Iterable<SubNode> iter = api.getChildren(session, node, false, 10000);

		/*
		 * build up a hashmap of all the SubNode objects keyed by the merkle hash, by
		 * scanning the children currently under the node that is being synced. The
		 * purpose of this loop is populate both nodeMap and nodesToDelete all in one
		 * pass across the children.
		 */
		for (SubNode child : iter) {
			if (forceRefresh) {
				nodesToDelete.add(child);
				continue;
			}
			String childHash = child.getStringProp(TYPES.IPFS_LINK);

			if (childHash != null) {
				nodeMap.put(childHash, child);
				// log.debug("existing NodeHash=" + childHash);
			} else {
				log.debug("node has no IPFS Hash! This is probably a bug: subNodeId=" + child.getId());
				/*
				 * If this node is missing property link property we blow it away.
				 */
				nodesToDelete.add(child);
			}
		}

		/* And now we delete all the nodes that we collected for deletion above. That is, since we are doing a sync, any child nodes under this node
		that are not in the MerkleNode we got from the web will be deleted. */
		boolean nodesDeleted = false;
		if (!nodesToDelete.isEmpty()) {
			nodesDeleted = true;
			for (SubNode delNode : nodesToDelete) {
				api.delete(session, delNode);
			}
		}

		/*
		 * First, scan all IPFS nodes and for any that don't have an existing SubNode,
		 * create the SubNode
		 */
		long ordinal = 1;
		if (merkNode.getLinks() != null) {
			for (MerkleLink mnode : merkNode.getLinks()) {
				SubNode sNode = null;
				boolean save = false;

				/* If there's no node existing for this hash */
				if (!nodeMap.containsKey(mnode.getHash())) {
					sNode = createNode(session, node, mnode, ordinal, stats);
					nodeMap.put(mnode.getHash(), sNode);
					save = true;
				}
				/*
				 * todo-2: Else if we have a node for this IPFS node, then verify the node is up
				 * to date. I don't think this block of code will ever have any effect, but is here just
				 * for correctness. That is, if the merkle data *did* somehow change we get the new data.
				 */
				else {
					sNode = nodeMap.get(mnode.getHash());
					log.debug("Node existed for FS resource: " + mnode.getHash());

					/*
					 * if node exists check ordinal and update if it's changed.
					 */
					if (!sNode.getOrdinal().equals(ordinal)) {
						sNode.setOrdinal(ordinal);
						save = true;
					}
				}

				if (sNode != null && save) {
					api.save(session, sNode);
				}
				ordinal++;
			}
		}

		List<String> keysToDelete = new LinkedList<String>();
		/*
		 * And finally we clean out orphaned nodes. Any nodes that exist in Quantizr DB
		 * for which there is no longer an associated IPFS node.
		 */
		for (Map.Entry<String, SubNode> entry : nodeMap.entrySet()) {
			String hashKey = entry.getKey();
			SubNode nodeEntry = entry.getValue();

			if (!merkleNodeMap.containsKey(hashKey)) {
				log.debug("Deleted node because LINK was unknown: " + hashKey);
				api.delete(session, nodeEntry);
				keysToDelete.add(hashKey);
				nodesDeleted = true;
			} //
			else {
				// log.debug("NON-ORPHAN: "+name);
			}
		}

		/* remove all keysToDelete, from map */
		for (String key : keysToDelete) {
			nodeMap.remove(key);
		}

		// todo-p0: see if we can combine both api.saveSession calls into just one at
		// the end.
		if (nodesDeleted) {
			api.saveSession(session);
		}

		// Allowing this recursion here would be a true 'Web Crawl' which we aren't
		// doing yet.
		// Currently we only crawl
		// one level at a time as the user expands in the gui using the "open" button to
		// explore nodes. Enabling a fully-recursive crawl feature will ONLY require
		// code like the
		// following 10 lines to be uncommented.
		//
		// if (recursive && folders != null) {
		// for (File folder : folders) {
		// SubNode folderNode = nodeMap.get(folder.getName());
		// if (folderNode == null) {
		// throw new RuntimeException("folder.getName " + folder.getName() + " wasn't
		// found in nodeMap");
		// }
		// processSync(session, folderNode, recursive, level + 1, stats);
		// }
		// }
	}

	/**
	 * Creates a new node when we detect an IPFS node is not yet represented in the
	 * SubNode database.
	 */
	public SubNode createNode(MongoSession session, SubNode parentNode, MerkleLink merkleLink, long ordinal,
			MerkleDAGSyncStats stats) {

		log.debug("IPFS resource: linkName=" + merkleLink.getName() + " hash=" + merkleLink.getHash());

		SubNode newNode = api.createNode(session, parentNode.getPath() + "/?", TYPES.IPFS_NODE.getName());
		String content = null;

		if (fileUtils.isImageFile(merkleLink.getName())) {
			//This query just returns an empty array as a 'links' property and then a json string representation of the image in the 'Data' property (not useful)
			//MerkleNode merkNode = ipfs.getMerkleNode(merkleLink.getHash(), "json");

			//todo-0: get this host/port/and protocol into application.properties
			//also this WILL be wrong right now. The name will be ipfs-dev, or ipfs-test, or ipfs-prod (based on docker-compose network naming)
			String imageUrl = "http://ipfs:8080/ipfs/" + merkleLink.getHash();

			// generating markdown that is nothing but a link to the image. Would be one approach we could use if we wanted to always query ipfs for the 
			// image data live, but as a proof-of-concept, what I'm instead doing below is pulling in the actual image data from IPFS to save 
			// in our own SubNode database.
			// content = "![img]("+ imageUrl + ")";

			//Let's instead pull the image data into our MongoDb.
			content = ""; //"IMAGE: "+merkleLink.getName();
			api.save(session, newNode);
			
			attachmentService.uploadFromUrl(session, imageUrl, newNode.getId().toHexString(), merkleLink.getName());

			//this re-query of the node is kind of ugly, and I need to tweak the design so that this isn't required, but currently it is.
			newNode = api.getNode(session, newNode.getId());
		}
		// For video support (tbd) it would be something similar to this i think:
		// else if (FileUtils.isVideoFile(MerkleLink.getName()) {
		// http://localhost:8080/ipfs/QmVc6zuAneKJzicnJpfrqCH9gSy6bz54JhcypfJYhGUFQu/play#/ipfs/QmTKZgRNwDNZwHtJSjCp6r5FYefzpULfy37JvMt9DwvXse
		// }
		else {
			content = ipfs.objectCat(merkleLink.getHash());
			if (content == null) {
				content = "";
			}

			// Set as 'preformatted' text, so the the Quantizr app doesn't try to render it
			// as markdown.
			newNode.setProp("pre", 1);
		}

		newNode.setContent(content);
		newNode.setProp(TYPES.IPFS_LINK, merkleLink.getHash());
		newNode.setProp(TYPES.IPFS_LINK_NAME, merkleLink.getName());

		newNode.setOrdinal(ordinal);
		newNode.setProp(NodeProp.IPFS_OK, true);
		return newNode;
	}

	/**
	 * Returns true if this is a type of node that can be synced to IPFS
	 */
	public boolean isSyncableNode(MongoSession session, SubNode node) {
		return node.isType(TYPES.IPFS_NODE);
	}
}
