package quanta.mongo;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.BulkOperations.BulkMode;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;
import com.mongodb.bulk.BulkWriteResult;
import com.mongodb.client.result.DeleteResult;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.model.SubNode;
import quanta.request.DeleteNodesRequest;
import quanta.response.DeleteNodesResponse;

// todo-0: Need to be sure we have TESTED ALL methods in this class by finding one use case for
// each.

/**
 * Performs the 'deletes' (as in CRUD) operations for deleting nodes in MongoDB
 */
@Component
public class MongoDelete extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(MongoDelete.class);

	public void deleteNode(MongoSession ms, SubNode node, boolean childrenOnly) {
		auth.ownerAuth(ms, node);
		if (!childrenOnly) {
			attach.deleteBinary(ms, "", node, null);
		}

		delete(ms, node, childrenOnly);
	}

	/*
	 * When a user is creating a new node we leave FIELD_MODIFY_TIME null until their first save of it
	 * and during the time it's null no other users can see the node. However the user can also abandon
	 * the browser or cancel the editing and orphan the node that way, and this method which we call
	 * only at startup, cleans up any and all of the orphans
	 */
	public void removeAbandonedNodes(MongoSession ms) {
		Query q = new Query();
		q.addCriteria(Criteria.where(SubNode.MODIFY_TIME).is(null));

		DeleteResult res = ops.remove(q, SubNode.class);
		log.debug("Num abandoned nodes deleted: " + res.getDeletedCount());
	}

	// DO NOT DELETE (this is referenced elsewhere, and is not currently, used but we DO WANT TO KEEP
	// IT.)
	public void removeFriendConstraintViolations(MongoSession ms) {
		Query q = new Query();

		// query for all FRIEND nodes (will represent both blocks and friends)
		Criteria crit = Criteria.where(SubNode.TYPE).is(NodeType.FRIEND.s());
		q.addCriteria(crit);

		HashSet<String> keys = new HashSet<>();

		Iterable<SubNode> nodes = mongoUtil.find(q);
		for (SubNode node : nodes) {
			if (no(node.getOwner()))
				continue;

			String key = node.getOwner().toHexString() + "-" + node.getStr(NodeProp.USER_NODE_ID);
			if (keys.contains(key)) {
				delete(ms, node);
			} else {
				keys.add(key);
			}
		}

		update.saveSession(ms);
	}

	// todo-0: this is pending a rewrite to maintain the 'node.hasChildren' on all parents. What we will
	// do
	// is scan all the nodes being removed first in a separate pass to accumulate the parent ID of all
	// parents,
	// and then we will do a 'parent.hasChildren=null' (unknown) for all those children. The hasChildren
	// values
	// will by design get set back to true/false as needed.
	public long deleteOldActPubPosts(int monthsOld, MongoSession ms) {
		return 0;
		// Query q = new Query();

		// // date 365 days ago. Posts over a year old will be removed
		// LocalDate ldt = LocalDate.now().minusDays(30 * monthsOld);
		// Date date = Date.from(ldt.atStartOfDay(ZoneId.systemDefault()).toInstant());

		// Criteria crit = Criteria.where(SubNode.PROPS + "." + NodeProp.ACT_PUB_OBJ_TYPE).ne(null) //
		// .and(SubNode.MODIFY_TIME).lt(date);

		// q.addCriteria(crit);
		// DeleteResult res = ops.remove(q, SubNode.class);
		// return res.getDeletedCount();
	}

	/*
	 * This is a way to cleanup old records, but it's not needed yet.
	 * 
	 * BEWARE: the updating of 'node.hasChildren' will need to be done like we do in other places in
	 * theis file using a batch update. For now this method is not used.
	 */
	public void cleanupOldTempNodesForUser(MongoSession ms, SubNode userNode) {
		Query q = new Query();

		LocalDate ldt = LocalDate.now().minusDays(5);
		Date date = Date.from(ldt.atStartOfDay(ZoneId.systemDefault()).toInstant());

		Criteria crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(userNode.getPath())) //
				.and(SubNode.MODIFY_TIME).lt(date); //

		q.addCriteria(crit);

		// set all the parents of all nodes in 'q' to null child status
		bulkSetPropValOnParents(ms, q, SubNode.HAS_CHILDREN, null);

		// Example: Time Range check:
		// query.addCriteria(Criteria.where("startDate").gte(startDate).lt(endDate));

		DeleteResult res = ops.remove(q, SubNode.class);
		if (res.getDeletedCount() > 0) {
			log.debug("Temp Records Deleted (Under User: " + userNode.getIdStr() + "): " + res.getDeletedCount());
		}
	}

	/**
	 * This method assumes security check is already done.
	 * 
	 * todo-1: performance enhancement: We could just delete the one node identified by 'path', and then
	 * run the recursive delete operation in an async thread. That's not ACID, but it's ok here, for the
	 * performance benefit. Perhaps only for 'admin' user only do it synchronously all without any
	 * async.
	 */
	public long deleteUnderPath(MongoSession ms, String path) {
		// log.debug("Deleting under path: " + path);
		update.saveSession(ms);
		Query q = new Query();
		q.addCriteria(Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(path)));

		Criteria crit = auth.addSecurityCriteria(ms, null);
		if (ok(crit)) {
			q.addCriteria(crit);
		}

		SubNode parent = read.getNode(ms, path);
		if (ok(parent)) {
			parent.setHasChildren(false);
		}

		DeleteResult res = ops.remove(q, SubNode.class);
		// log.debug("Num of SubGraph deleted: " + res.getDeletedCount());
		long totalDelCount = res.getDeletedCount();
		return totalDelCount;
	}

	/**
	 * Currently cleaning up GridFS orphans is done in gridMaintenanceScan() only, so when we delete one
	 * ore more nodes, potentially orphaning other nodes or GRID nodes (binary files), those orphans
	 * will get cleaned up later on, but not synchronously or in this method.
	 * 
	 * todo-2: However, we could also have the 'path' stored in the GridFS metadata so we can use a
	 * 'regex' query to delete all the binaries (recursively under any node, using that path prefix as
	 * the criteria) which is exacly like the one below for deleting the nodes themselves.
	 * 
	 * UPDATE: In here we call "regexRecursiveChildrenOfPath" which does the most aggressive possible
	 * delete of the entire subgraph, but it would be more performant to use a non-recursive delete ONLY
	 * of the direct children under 'node' (using "regexDirectChildrenOfPath" instead) in this
	 * synchronous call and let the orphan delete do the rest of the cleanup later on asynchronously.
	 * However we do NOT do that, only because our orphan cleanup algo is already memory intensive and
	 * so we are decreasing the memory load of the orphan cleanup routing by doing the most aggressive
	 * tree delete possible here, synchronously, at he cost of a little performance.
	 * 
	 * Said more simply: Replace 'regexRecursiveChildrenOfPath' with 'regexDirectChildrenOfPath' in this
	 * method if you want to increase performance of deletes at the cost of some additional memory.
	 */
	public long delete(MongoSession ms, SubNode node, boolean childrenOnly) {
		auth.ownerAuth(ms, node);
		log.debug("Deleting under path: " + node.getPath());

		update.saveSession(ms);

		/*
		 * First delete all the children of the node by using the path, knowing all their paths 'start with'
		 * (as substring) this path. Note how efficient it is that we can delete an entire subgraph in one
		 * single operation!
		 */
		Query q = new Query();
		q.addCriteria(Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(node.getPath())));

		DeleteResult res = ops.remove(q, SubNode.class);
		log.debug("Num of SubGraph deleted: " + res.getDeletedCount());
		long totalDelCount = res.getDeletedCount();

		/*
		 * Yes we DO have to remove the node itself separate from the remove of all it's subgraph, because
		 * in order to be perfectly safe the recursive subgraph regex MUST designate the slash AFTER the
		 * root path to be sure we get the correct node, other wise deleting /ab would also delete /abc for
		 * example. so we must have our recursive delete identify deleting "/ab" as starting with "/ab/"
		 */
		if (!childrenOnly) {
			DeleteResult ret = delete(ms, node);
			totalDelCount += ret.getDeletedCount();
		} else {
			// if we're deleting children only we just update the node's hasChildren to false. We know there are
			// none
			node.setHasChildren(false);
		}
		return totalDelCount;
	}

	/*
	 * Note: We don't even use this becasue it wouldn't delete the orphans. We always delete using the
	 * path prefix query so all subnodes in the subgraph go away (no orphans)
	 */
	public DeleteResult delete(MongoSession ms, SubNode node) {
		SubNode parent = read.getParent(ms, node, false);
		if (ok(parent)) {
			parent.setHasChildren(null);
		}
		return ops.remove(node);
	}

	public void deleteByPropVal(MongoSession ms, String prop, String val) {
		// log.debug("Deleting by prop=" + prop + " val=" + val);
		Query q = new Query();
		Criteria crit = Criteria.where(SubNode.PROPS + "." + prop).is(val);
		crit = auth.addSecurityCriteria(ms, crit);
		q.addCriteria(crit);

		// since we're deleting all nodes matching the query 'q' we set the parents of all those nodes do unknown children state
		bulkSetPropValOnParents(ms, q, SubNode.HAS_CHILDREN, null);

		// look for all calls to 'ops.remove' just to doublecheck none of them need the above
		// 'bulkSetPropValOnParents'
		DeleteResult res = ops.remove(q, SubNode.class);
		log.debug("Nodes deleted: " + res.getDeletedCount());
	}

	// iterates over 'q' setting prop=val on ever PARENT node of all those nodes.
	public void bulkSetPropValOnParents(MongoSession ms, Query q, String prop, Object val) {
		BulkOperations bops = ops.bulkOps(BulkMode.UNORDERED, SubNode.class);

		// this hash set just makes sure we only submit each val set once! No replicated work.
		HashSet<ObjectId> parentIds = new HashSet<>();
		long threadId = Thread.currentThread().getId();

		ops.stream(q, SubNode.class).forEachRemaining(node -> {

			// since I'm new to ops.stream, I don't trust it to be threadsafe yet.
			if (threadId != Thread.currentThread().getId()) {
				throw new RuntimeException("ops.stream unexpected concurrency");
			}

			SubNode parent = read.getParent(ms, node, false);
			if (ok(parent) && parentIds.add(parent.getId())) {
				// we have a known 'bops' in this one and don't lazy create so we don't care about the
				// return value of this call
				bulkOpSetPropVal(bops, parent.getId(), prop, val);
			}
		});

		BulkWriteResult results = bops.execute();
		log.debug("bulkPropValOnParents PROP[" + prop + "]=[" + val + "] " + results.getModifiedCount() + " nodes.");
	}

	public void bulkSetPropsByIdObjs(Collection<ObjectId> ids, String prop, Object val) {
		BulkOperations bops = null;

		for (ObjectId id : ids) {
			bops = bulkOpSetPropVal(bops, id, prop, null);
		}

		if (ok(bops)) {
			BulkWriteResult results = bops.execute();
			log.debug("bulkSetProps Updated PROP[" + prop + "]=[" + val + "] " + results.getModifiedCount() + " nodes.");
		}
	}

	public void bulkSetPropsByIdStr(Collection<String> ids, String prop, Object val) {
		BulkOperations bops = null;

		for (String id : ids) {
			bops = bulkOpSetPropVal(bops, new ObjectId(id), prop, null);
		}

		if (ok(bops)) {
			BulkWriteResult results = bops.execute();
			log.debug("bulkSetProps Updated " + results.getModifiedCount() + " nodes.");
		}
	}

	// note: Is there a way to leverage the new 'hasChildren' node prop to make this fast?
	public void deleteNodeOrphans() {
		// todo-0: removed due to SubNode.getParent() being deleted
		// log.debug("deleteNodeOrphans()");
		// // long nodeCount = read.getNodeCount(null);
		// // log.debug("initial Node Count: " + nodeCount);

		// Val<Integer> orphanCount = new Val<>(0);
		// int loops = 0;

		// /*
		// * Run this loop up to 3 per call. Note that for large orphaned subgraphs we only end up pruning
		// off the
		// * N deepest levels at a time, so running this multiple times will be required, but this is ideal.
		// * We could raise this N to a larger number larger than any possible tree depth, but there's no
		// * need. Running this several times has the same effect.
		// */
		// while (++loops <= 3) {
		// log.debug("Delete Orphans. Loop: " + loops);
		// Val<Integer> nodesProcessed = new Val<>(0);
		// Val<Integer> deleteCount = new Val<>(0);
		// Val<Integer> batchSize = new Val<>(0);

		// // bulk operations is scoped only to one iteration, just so it itself can't be too large
		// Val<BulkOperations> bops = new Val<>(null);

		// Query allQuery = new Query().addCriteria(new Criteria(SubNode.PARENT).ne(null));
		// /*
		// * Now scan every node again and any PARENT not in the set means that parent doesn't exist and so
		// * the node is an orphan and can be deleted.
		// */
		// ops.stream(allQuery, SubNode.class).forEachRemaining(node -> {
		// // print progress every 1000th node
		// nodesProcessed.setVal(nodesProcessed.getVal() + 1);
		// if (nodesProcessed.getVal() % 1000 == 0) {
		// log.debug("Nodes Processed: " + nodesProcessed.getVal());
		// }

		// // ignore the root node and any of it's children.
		// if ("/r".equalsIgnoreCase(node.getPath()) || //
		// "/r".equalsIgnoreCase(node.getParentPath())) {
		// return;
		// }

		// /*
		// * if there's a parent specified (always should be except for root), but we can't find the parent
		// * then this node is an orphan to be deleted
		// */
		// if (no(ops.findById(node.getParent(), SubNode.class))) {
		// log.debug("DEL ORPHAN id=" + node.getIdStr() + " path=" + node.getPath() + " Content=" +
		// node.getContent());
		// orphanCount.setVal(orphanCount.getVal() + 1);
		// deleteCount.setVal(deleteCount.getVal() + 1);

		// // lazily create the bulk ops
		// if (no(bops.getVal())) {
		// bops.setVal(ops.bulkOps(BulkMode.UNORDERED, SubNode.class));
		// }

		// Query query = new Query().addCriteria(new Criteria("id").is(node.getId()));
		// bops.getVal().remove(query);

		// batchSize.setVal(batchSize.getVal() + 1);
		// if (batchSize.getVal() >= 200) {
		// batchSize.setVal(0);;
		// BulkWriteResult results = bops.getVal().execute();
		// log.debug("Orphans Deleted Batch: " + results.getDeletedCount());
		// bops.setVal(null);
		// }
		// }
		// });

		// if (ok(bops.getVal())) {
		// BulkWriteResult results = bops.getVal().execute();
		// log.debug("Orphans Deleted (batch remainder): " + results.getDeletedCount());
		// }

		// // if no deletes were done, break out of while loop and return.
		// if (deleteCount.getVal() == 0) {
		// break;
		// }
		// }

		// log.debug("TOTAL ORPHANS DELETED=" + orphanCount.getVal());
		// // nodeCount = read.getNodeCount(null);
		// // log.debug("final Node Count: " + nodeCount);
	}

	/*
	 * Deletes the set of nodes specified in the request
	 */
	public DeleteNodesResponse deleteNodes(MongoSession ms, DeleteNodesRequest req) {
		DeleteNodesResponse res = new DeleteNodesResponse();

		SubNode userNode = read.getUserNodeByUserName(null, null);
		if (no(userNode)) {
			throw new RuntimeEx("User not found.");
		}

		BulkOperations bops = null;
		List<SubNode> nodes = new LinkedList<>();
		HashSet<ObjectId> parentIds = new HashSet<>();

		for (String nodeId : req.getNodeIds()) {
			// lookup the node we're going to delete
			SubNode node = read.getNode(ms, nodeId);
			if (no(node))
				continue;
			auth.ownerAuth(ms, node);

			// get the parent of the node and add it's id to parentIds
			SubNode parent = read.getParent(ms, node, false);
			if (no(parent)) {
				// if node has no parent it's an orphan, so we should act like it doesn't even exist, and it's essentially
				// already deleted.
				// todo-1: Could we have a background queue mow thru "Known Orphans" like this one, because any
				// subnodes
				// of it can be blown away once you identify an orphan by whatever means it was.
				continue;
			}

			// back out the number of bytes it was using
			if (!ms.isAdmin()) {
				/*
				 * NOTE: There is no equivalent to this on the IPFS code path for deleting ipfs becuase since we
				 * don't do reference counting we let the garbage collecion cleanup be the only way user quotas are
				 * deducted from.
				 * 
				 * todo-1: Also this is incorrect for now. If the user deletes a deep subgraph of nodes we don't
				 * grant them back the space, so this would cheat users. Need to fix that.
				 */
				user.addNodeBytesToUserNodeBytes(ms, node, userNode, -1);
			}

			// really need a 'hasForeignShares' here to ignore if there aren't any (todo-1)
			if (ok(node.getAc())) {
				nodes.add(node);
			}

			// if 'add' returns true that means this IS the first encounter and so we add to the operations
			// the call to set it's hasChildren to null
			if (parentIds.add(parent.getId())) {
				bops = bulkOpSetPropVal(bops, parent.getId(), SubNode.HAS_CHILDREN, null);
			}

			/*
			 * we remove the actual specified nodes synchronously here (instead of including root in
			 * deleteSubGraphChildren below), so that the client can refresh as soon as it wants and get back
			 * correct results.
			 */
			bops = bulkOpRemoveNode(bops, node.getId());
		}

		// in async thread send out all the deletes to the foreign servers.
		exec.run(() -> {
			nodes.forEach(n -> {
				apub.sendNodeDelete(ms, snUtil.getIdBasedUrl(n), snUtil.cloneAcl(n));
				deleteSubGraphChildren(ms, n, false);
			});
		});

		if (ok(bops)) {
			BulkWriteResult results = bops.execute();
			log.debug("Nodes Deleted + ParentsUpdated = " + results.getDeletedCount());
		}

		update.saveSession(ms);
		res.setSuccess(true);
		return res;
	}

	/*
	 * Note: this method assumes that the user associated with 'ms' already has been checked for
	 * authorization to delete 'node' (owns the node)
	 */
	public void deleteSubGraphChildren(MongoSession ms, SubNode node, boolean includeRoot) {
		BulkOperations bops = null;

		// if deleting root do it first because the getSubGraph query doesn't include root.
		if (includeRoot) {
			// if deleting children AND root then the parent of this root is the one we need to update the
			// hasChildren for
			SubNode parent = read.getParent(ms, node, false);
			if (ok(parent)) {
				bops = bulkOpSetPropVal(bops, parent.getId(), SubNode.HAS_CHILDREN, null);
			}
			bops = bulkOpRemoveNode(bops, node.getId());
		}
		// if deleting all children and NOT root we know we can just update the node hasChildren to false
		else {
			bops = bulkOpSetPropVal(bops, node.getId(), SubNode.HAS_CHILDREN, null);
		}

		// Now Query the entire subgraph of this deleted 'node'
		// todo-1: Actually we can do even better here, and just run a single command 'delete' op on the
		// underlying
		// query that this getSubGraph ends up using, and not even need a bulk op.
		for (SubNode child : read.getSubGraph(ms, node, null, 0, false, false, false)) {
			/*
			 * NOTE: Disabling this ability to recursively delete from foreign servers because I'm not sure they
			 * won't interpret that as a DDOS attack if this happens to be a large delete underway. This will
			 * take some thought, to engineer where perhaps we limit to just 10, and do them over a period of 10
			 * minutes even, and that kind of thing, but for now we can just get by without this capability
			 */
			// apub.sendActPubForNodeDelete(ms, snUtil.getIdBasedUrl(child), snUtil.cloneAcl(child));
			bops = bulkOpRemoveNode(bops, child.getId());
		}

		// deletes all nodes in this subgraph branch
		if (ok(bops)) {
			BulkWriteResult results = bops.execute();
			log.debug("SubGraph of " + node.getIdStr() + " Nodes Deleted: " + results.getDeletedCount());
		}
	}

	// returns a new BulkOps if one not yet existing
	public BulkOperations bulkOpRemoveNode(BulkOperations bops, ObjectId id) {
		if (no(bops)) {
			bops = ops.bulkOps(BulkMode.UNORDERED, SubNode.class);
		}
		Query query = new Query().addCriteria(new Criteria("id").is(id));
		bops.remove(query);
		return bops;
	}

	// returns a new BulkOps if one not yet existing
	public BulkOperations bulkOpSetPropVal(BulkOperations bops, ObjectId id, String prop, Object val) {
		if (no(bops)) {
			bops = ops.bulkOps(BulkMode.UNORDERED, SubNode.class);
		}
		Query query = new Query().addCriteria(new Criteria("id").is(id));
		Update update = new Update().set(prop, val);
		bops.updateOne(query, update);
		return bops;
	}

	/*
	 * Deletes the set of nodes specified in the request
	 */
	public DeleteNodesResponse bulkDeleteNodes(MongoSession ms) {
		DeleteNodesResponse res = new DeleteNodesResponse();

		SubNode userNode = read.getUserNodeByUserName(null, null);
		if (no(userNode)) {
			throw new RuntimeEx("User not found.");
		}

		Query q = new Query();

		// criteria finds all nodes where we are the owner but they're not decendants under our own tree
		// root.
		Criteria crit = Criteria.where(SubNode.OWNER).is(userNode.getOwner()).and(SubNode.PATH).not()
				.regex(mongoUtil.regexRecursiveChildrenOfPathIncludeRoot(userNode.getPath()));
		q.addCriteria(crit);

		// we'll be deleting every node in 'q' so we need to set the parents of all those to hasChildren=null (unknown)
		bulkSetPropValOnParents(ms, q, SubNode.HAS_CHILDREN, null);

		/*
		 * This will potentially leave orphans and this is fine. We don't bother cleaning orphans now
		 * becasue there's no need.
		 */
		DeleteResult delRes = ops.remove(q, SubNode.class);
		String msg = "Nodes deleted: " + delRes.getDeletedCount();
		log.debug("Bulk Delete: " + msg);
		res.setMessage(msg);

		res.setSuccess(true);
		return res;
	}
}
