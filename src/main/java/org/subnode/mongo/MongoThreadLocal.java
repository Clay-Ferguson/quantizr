package org.subnode.mongo;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.bson.types.ObjectId;
import org.subnode.mongo.model.SubNode;

public class MongoThreadLocal {
	private static final Logger log = LoggerFactory.getLogger(MongoThreadLocal.class);

	private static int MAX_CACHE_SIZE = 100;

	/*
	 * This is where we can accumulate the set of nodes that will all be updated
	 * after processing is done using the api.sessionSave() call. This is not an
	 * ACID commit, but a helpful way to not have to worry about doing SAVES on
	 * every object that is touched during the processing of a thread/request. This
	 * is because we can use a pattern that wraps the 'api.sessionSave()' in a
	 * finally block somewhere and use that to make sure all updates to any node are
	 * saved.
	 * 
	 * todo-1: consider repurposing dirtyNodes to only *catch* bugs by making it
	 * print which nodes were modified but never saved, and call this in the web
	 * filter on the way out of each request, and then change the code style back to
	 * where it only writes WHEN 'save' is called on each node.
	 * 
	 * and also, we can use this map to detect WHEN some query is done that reads a
	 * node in a query such that the node read is actually in the 'dirtyNodes' map
	 * (of same session) meaning there will then be TWO copies of the node in memory
	 * and could be a problem because whichever one is saved last will 'win'
	 * (overwrite the other)
	 */
	private static final ThreadLocal<HashMap<ObjectId, SubNode>> dirtyNodes = new ThreadLocal<HashMap<ObjectId, SubNode>>();

	private static final ThreadLocal<LinkedHashMap<String, SubNode>> nodesByPath = new ThreadLocal<LinkedHashMap<String, SubNode>>();

	public static void removeAll() {
		// log.debug("Clear Dirty Nodes.");
		getDirtyNodes().clear();
		getNodesByPath().clear();
	}

	public static void clearDirtyNodes() {
		getDirtyNodes().clear();
	}

	/*
	 * NOTE: It's not an ineffecincy to always create the map any time it's
	 * accessed, even though it could have been left empty because this is a
	 * thread-local storage and so this map is reused over and over by all different
	 * requests and different users, so we only ever create one per thread anyway,
	 * and the thread pool is mainly fixed in size and small.
	 */
	public static HashMap<ObjectId, SubNode> getDirtyNodes() {
		if (dirtyNodes.get() == null) {
			dirtyNodes.set(new HashMap<ObjectId, SubNode>());
		}
		return dirtyNodes.get();
	}

	public static boolean hasDirtyNodes() {
		return getDirtyNodes().size() > 0;
	}

	public static LinkedHashMap<String, SubNode> getNodesByPath() {
		if (nodesByPath.get() == null) {
			nodesByPath.set(new LinkedHashMap<String, SubNode>(MAX_CACHE_SIZE + 1, .75F, false) {
				protected boolean removeEldestEntry(Map.Entry<String, SubNode> eldest) {
					return size() > MAX_CACHE_SIZE;
				}
			});
		}
		return nodesByPath.get();
	}

	public static boolean hasNodesByPath() {
		return getNodesByPath().size() > 0;
	}

	public static void dumpDirtyNodes() {
		if (getDirtyNodes().size() == 0) {
			log.debug("No dirty nodes.");
			return;
		}

		log.debug("Dirty Nodes...");
		getDirtyNodes().forEach((key, value) -> {
			log.debug("    " + key.toHexString());
		});
	}

	/*
	 * Sets 'node' to dirty thus guaranteeing any changes made to it, even if made
	 * later on in the request, are guaranteed to be written out
	 */
	public static void dirty(SubNode node) {
		if (node.getId() == null) {
			return;
		}

		SubNode nodeFound = getDirtyNodes().get(node.getId());

		/*
		 * If we are setting this node to dirty, but we already see another copy of the
		 * same nodeId in memory, this is a problem and will mean which ever node
		 * happens to be saved 'last' will overwrite, so this *may* result in data loss.
		 * 
		 * todo-1: Should we find a way to be sure this never happens? This is basically
		 * another way of saying with non-ACID databases transactions don't really
		 * 'work'
		 */
		if (nodeFound != null && nodeFound.hashCode() != node.hashCode()) {
			log.debug("*************** oops multiple instance of object:" + node.getId().toHexString()
					+ " are in memory. Ignoring attempt to set the second one to dirty");
			return;
		}

		getDirtyNodes().put(node.getId(), node);
	}

	/* Opposite of dirty */
	public static void clean(SubNode node) {
		// log.debug("Removing from Dirty: " + node.getId().toHexString());

		// commenting this 'if' we don't care if the remove is doing something or now.
		// if (getDirtyNodes().containsKey(node.getId())) {
		getDirtyNodes().remove(node.getId());
		// }
	}
}
