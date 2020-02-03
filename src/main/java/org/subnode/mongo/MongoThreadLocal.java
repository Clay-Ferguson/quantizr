package org.subnode.mongo;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;

import org.subnode.mongo.model.SubNode;

public class MongoThreadLocal {
	/*
	 * This is where we can accumulate a series of nodes that will all be updated after processing
	 * is done using the api.sessionSave() call. This is not true ACID of course, but a helpful way
	 * to not have to worry about doing SAVES on every object that is touched during the processing
	 * of a thread/request. This is because we can use a pattern that wraps the 'api.sessionSave()'
	 * in a finally block somewhere and use that to make sure all work ever done (Node property
	 * updates, etc) gets 'committed'
	 */
	private static final ThreadLocal<HashMap<String, SubNode>> dirtyNodes = new ThreadLocal<HashMap<String, SubNode>>();

	/*
	 * Because ACL checking is an expensive operation, we cache the results of any ACL computations,
	 * during the course of any single HTTP Request (i.e. per thread) Note: We do not use
	 * "Request Scope" Spring bean because we want this to work on ANY thread, including just
	 * running test cases.
	 */
	private static final ThreadLocal<HashMap<String, Boolean>> aclResults = new ThreadLocal<HashMap<String, Boolean>>();

	public static void removeAll() {
		dirtyNodes.remove();
		aclResults.remove();
	}

	public static void setDirtyNodes(HashMap<String, SubNode> res) {
		dirtyNodes.set(res);
	}

	public static HashMap<String, SubNode> getDirtyNodes() {
		return dirtyNodes.get();
	}
	
	public static HashMap<String, SubNode> dirtyNodes() {
		if (dirtyNodes.get() == null) {
			dirtyNodes.set(new HashMap<String, SubNode>());
		}
		return dirtyNodes.get();
	}

	/*
	 * todo-0: Nice enhancement would be if a node is getting flagged as dirty make sure there isn't
	 * already a DIFFERENT instance of the same node ID flagged as dirty, because this would be a
	 * BUG always. The last one written would overwrite, so this means if we are working on updating
	 * two object instances of the same 'node id' at once that is a BUG for sure.
	 */
	public static void dirty(SubNode node) {
		if (node.getId() == null || node.isWriting() || node.isDeleted()) {
			return;
		}
		dirtyNodes().put(node.getId().toHexString(), node);
	}

	public static void autoCleanup(MongoSession session) {
		if (getDirtyNodes() == null || getDirtyNodes().values() == null) return;

		List<SubNode> nodesToClean = null;

		/*
		 * to avoid ConcurrentModification we scan and build up all the nodes that need to be
		 * cleaned out and hold them in nodesToClean
		 */
		for (SubNode node : MongoThreadLocal.getDirtyNodes().values()) {
			if (node.isWriting() || node.isDeleted()) {
				if (nodesToClean == null) {
					nodesToClean = new LinkedList<SubNode>();
				}
				nodesToClean.add(node);
			}
		}
		if (nodesToClean == null) return;

		for (SubNode node : nodesToClean) {
			MongoThreadLocal.getDirtyNodes().remove(node.getId().toHexString());
		}
	}
	
	public static void cleanAll() {
		dirtyNodes().clear();
	}
	
	public static void setAclResults(HashMap<String, Boolean> res) {
		aclResults.set(res);
	}

	public static HashMap<String, Boolean> getAclResults() {
		return aclResults.get();
	}
	
	public static HashMap<String, Boolean> aclResults() {
		if (aclResults.get() == null) {
			aclResults.set(new HashMap<String, Boolean>());
		}
		return aclResults.get();
	}

}
