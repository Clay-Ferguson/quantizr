package org.subnode.mongo;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;

import org.bson.types.ObjectId;
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
	private static final ThreadLocal<HashMap<ObjectId, SubNode>> dirtyNodes = new ThreadLocal<HashMap<ObjectId, SubNode>>();

	/*
	 * Because ACL checking is an expensive operation, we cache the results of any ACL computations,
	 * during the course of any single HTTP Request (i.e. per thread) Note: We do not use
	 * "Request Scope" Spring bean because we want this to work on ANY thread, including just
	 * running test cases.
	 */
	private static final ThreadLocal<HashMap<String, Boolean>> aclResults = new ThreadLocal<HashMap<String, Boolean>>();

	public static void removeAll() {
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
	 * todo-1: Nice enhancement would be if a node is getting flagged as dirty make sure there isn't
	 * already a DIFFERENT instance of the same node ID flagged as dirty, because this would be a
	 * BUG always. The last one written would overwrite, so this means if we are working on updating
	 * two object instances of the same 'node id' at once that is a BUG for sure.
	 */
	public static void dirty(SubNode node) {
		if (node.getId() == null) {
			return;
		}
		getDirtyNodes().put(node.getId(), node);
	}

	/* Opposite of dirty */
	public static void clean(SubNode node) {
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
