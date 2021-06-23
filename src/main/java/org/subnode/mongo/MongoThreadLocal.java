package org.subnode.mongo;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.subnode.mongo.model.SubNode;

public class MongoThreadLocal {
	private static final Logger log = LoggerFactory.getLogger(MongoThreadLocal.class);

	/*
	 * This is where we can accumulate the set of nodes that will all be updated after processing is
	 * done using the api.sessionSave() call. This is a way to not have to worry about doing SAVES on
	 * every object that is touched during the processing of a thread/request.
	 */
	private static final ThreadLocal<HashMap<ObjectId, SubNode>> dirtyNodes = new ThreadLocal<HashMap<ObjectId, SubNode>>();
	private static final ThreadLocal<LinkedHashMap<String, SubNode>> cachedNodes =
			new ThreadLocal<LinkedHashMap<String, SubNode>>();
	private static final ThreadLocal<Boolean> writesDisabled = new ThreadLocal<Boolean>();

	private static int MAX_CACHE_SIZE = 50;

	public static void removeAll() {
		// log.debug("Clear Dirty Nodes.");
		getDirtyNodes().clear();
		getCachedNodes().clear();
		setWritesDisabled(false);
	}

	public static void setWritesDisabled(Boolean val) {
		writesDisabled.set(val);
	}

	public static Boolean getWritesDisabled() {
		if (writesDisabled.get() == null)
			return false;
		return writesDisabled.get();
	}

	public static void clearDirtyNodes() {
		getDirtyNodes().clear();
	}

	public static void clearCachedNodes() {
		getCachedNodes().clear();
	}

	public static HashMap<ObjectId, SubNode> getDirtyNodes() {
		if (dirtyNodes.get() == null) {
			dirtyNodes.set(new HashMap<ObjectId, SubNode>());
		}
		return dirtyNodes.get();
	}

	private static LinkedHashMap<String, SubNode> getCachedNodes() {
		if (cachedNodes.get() == null) {
			LinkedHashMap<String, SubNode> cn = new LinkedHashMap<String, SubNode>(MAX_CACHE_SIZE + 1, .75F, false) {
				protected boolean removeEldestEntry(Map.Entry<String, SubNode> eldest) {
					return size() > MAX_CACHE_SIZE;
				}
			};
			cachedNodes.set(cn);
		}
		return cachedNodes.get();
	}

	public static boolean hasDirtyNodes() {
		return getDirtyNodes().size() > 0;
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
	 * Sets 'node' to dirty thus guaranteeing any changes made to it, even if made later on in the
	 * request, are guaranteed to be written out
	 */
	public static void dirty(SubNode node) {
		if (node.getId() == null) {
			return;
		}

		SubNode nodeFound = getDirtyNodes().get(node.getId());

		/*
		 * If we are setting this node to dirty, but we already see another copy of the same nodeId in
		 * memory, this is a problem and will mean whichever node happens to be saved 'last' will overwrite,
		 * so this *may* result in data loss.
		 * 
		 * todo-1: Should we find a way to be sure this never happens? This is basically another way of
		 * saying with non-ACID databases transactions don't really 'work'
		 */
		if (nodeFound != null && nodeFound.hashCode() != node.hashCode()) {
			log.debug("*************** ERROR: multiple instances of objectId " + node.getId().toHexString() + " are in memory.");
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

	public static void cacheNode(SubNode node) {
		if (node == null)
			return;

		if (node.getPath() != null) {
			getCachedNodes().put(node.getPath(), node);
		}
		if (node.getId() != null) {
			getCachedNodes().put(node.getId().toHexString(), node);
		}
	}

	public static SubNode getCachedNode(String key) {
		if (StringUtils.isEmpty(key))
			return null;
		return getCachedNodes().get(key);
	}
}
