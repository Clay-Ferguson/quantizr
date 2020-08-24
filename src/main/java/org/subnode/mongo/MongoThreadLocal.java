package org.subnode.mongo;

import java.util.HashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.bson.types.ObjectId;
import org.subnode.mongo.model.SubNode;

public class MongoThreadLocal {
	private static final Logger log = LoggerFactory.getLogger(MongoThreadLocal.class);

	/*
	 * This is where we can accumulate the set of nodes that will all be updated
	 * after processing is done using the api.sessionSave() call. This is not an
	 * ACID commit, but a helpful way to not have to worry about doing SAVES on
	 * every object that is touched during the processing of a thread/request. This
	 * is because we can use a pattern that wraps the 'api.sessionSave()' in a
	 * finally block somewhere and use that to make sure all updates ao any node are
	 * saved.
	 */
	private static final ThreadLocal<HashMap<ObjectId, SubNode>> dirtyNodes = new ThreadLocal<HashMap<ObjectId, SubNode>>();

	/*
	 * Because ACL checking is an expensive operation, we cache the results of any
	 * ACL computations, during the course of any single HTTP Request (i.e. per
	 * thread) Note: We do not use "Request Scope" Spring bean because we want this
	 * to work on ANY thread, including just running test cases.
	 */
	private static final ThreadLocal<HashMap<String, Boolean>> aclResults = new ThreadLocal<HashMap<String, Boolean>>();

	public static void removeAll() {
		// log.debug("Clear Dirty Nodes.");
		getDirtyNodes().clear();
		getAclResults().clear();
	}

	public static HashMap<ObjectId, SubNode> getDirtyNodes() {
		if (dirtyNodes.get() == null) {
			dirtyNodes.set(new HashMap<ObjectId, SubNode>());
		}
		return dirtyNodes.get();
	}

	public static boolean hasDirtyNodes() {
		return getDirtyNodes().size() > 0;
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
		getDirtyNodes().remove(node.getId());
	}

	public static void setAclResults(HashMap<String, Boolean> res) {
		aclResults.set(res);
	}

	public static HashMap<String, Boolean> getAclResults() {
		if (aclResults.get() == null) {
			aclResults.set(new HashMap<String, Boolean>());
		}
		return aclResults.get();
	}
}
