package quanta.mongo;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import com.mongodb.bulk.BulkWriteResult;
import com.mongodb.client.result.DeleteResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.BulkOperations.BulkMode;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.model.SubNode;
import quanta.request.DeleteNodesRequest;
import quanta.response.DeleteNodesResponse;

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

			String key = node.getOwner().toHexString() + "-" + node.getStr(NodeProp.USER_NODE_ID.s());
			if (keys.contains(key)) {
				delete(node);
			} else {
				keys.add(key);
			}
		}

		update.saveSession(ms);
	}

	/**
	 * Deletes old activity pub posts, just to save space on our server. Admin option only.
	 */
	public long deleteOldActPubPosts(SubNode parent, MongoSession ms) {
		Query q = new Query();

		// date 90 days ago.
		LocalDate ldt = LocalDate.now().minusDays(90);
		Date date = Date.from(ldt.atStartOfDay(ZoneId.systemDefault()).toInstant());

		Criteria crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(parent.getPath())) //
				.and(SubNode.PROPS + "." + NodeProp.ACT_PUB_ID).ne(null) //
				.and(SubNode.MODIFY_TIME).lt(date);

		q.addCriteria(crit);
		DeleteResult res = ops.remove(q, SubNode.class);
		return res.getDeletedCount();
	}

	/* This is a way to cleanup old records, but it's not needed yet */
	public void cleanupOldTempNodesForUser(MongoSession ms, SubNode userNode) {
		Query q = new Query();

		LocalDate ldt = LocalDate.now().minusDays(5);
		Date date = Date.from(ldt.atStartOfDay(ZoneId.systemDefault()).toInstant());

		Criteria crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(userNode.getPath())) //
				.and(SubNode.MODIFY_TIME).lt(date); //

		/*
		 * once we've had the TEMP prop in place for 7 days, we can then process this code from the root
		 * path of all users rather than running it once on each foreign user node, and remove 'ForUser'
		 * from method name and(SubNode.PROPS+ "." + NodeProp.TEMP.s()).ne(null));
		 */

		q.addCriteria(crit);

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
			DeleteResult d2 = ops.remove(node);
			totalDelCount += d2.getDeletedCount();
		}
		return totalDelCount;
	}

	/*
	 * Note: We don't even use this becasue it wouldn't delete the orphans. We always delete using the
	 * path prefix query so all subnodes in the subgraph go away (no orphans)
	 */
	public void delete(SubNode node) {
		ops.remove(node);
	}

	public void deleteByPropVal(MongoSession ms, String prop, String val) {
		// log.debug("Deleting by prop=" + prop + " val=" + val);
		Query q = new Query();
		Criteria crit = Criteria.where(SubNode.PROPS + "." + prop).is(val);
		crit = auth.addSecurityCriteria(ms, crit);
		q.addCriteria(crit);
		DeleteResult res = ops.remove(q, SubNode.class);
		// log.debug("Nodes deleted: " + res.getDeletedCount());
	}

	public void deleteNodeOrphans(MongoSession ms) {
		log.debug("deleteNodeOrphans()");
		// long nodeCount = read.getNodeCount(null);
		// log.debug("initial Node Count: " + nodeCount);

		if (no(ms)) {
			ms = auth.getAdminSession();
		}

		int orphanCount = 0;
		int loops = 0;

		/*
		 * Run this up to 3 per call. Note that for large orphaned subgraphs we only end up pruning off the
		 * 10 deepest levels at a time, so running this multiple times will be required, but this is ideal.
		 * We could raise this 10 to a larger number larger than any possible tree depth, but there's no
		 * need. Running this several times has the same effect
		 */
		while (++loops < 3) {
			int nodesProcessed = 0;
			int deleteCount = 0;

			// bulk operations is scoped only to one iteration, just so it itself can't be too large
			BulkOperations bops = null;

			/*
			 * Now scan every node again and any PARENT not in the set means that parent doesn't exist and so
			 * the node is an orphan and can be deleted.
			 */
			Iterable<SubNode> nodes = ops.findAll(SubNode.class);

			for (SubNode node : nodes) {
				// print progress every 2000th node
				if (++nodesProcessed % 2000 == 0) {
					log.debug("Nodes Processed: " + nodesProcessed);
				}

				// ignore the root node and any of it's children.
				if ("/r".equalsIgnoreCase(node.getPath()) || //
						"/r".equalsIgnoreCase(node.getParentPath())) {
					continue;
				}

				/*
				 * if there's a parent specified (always should be except for root), but we can't find the parent
				 * then this node is an orphan to be deleted
				 */
				if (ok(node.getParent()) && no(ops.findById(node.getParent(), SubNode.class))) {
					log.debug("DEL ORPHAN id=" + node.getIdStr() + " path=" + node.getPath() + " Content=" + node.getContent());
					orphanCount++;
					deleteCount++;

					if (no(bops)) {
						bops = ops.bulkOps(BulkMode.UNORDERED, SubNode.class);
					}

					Query query = new Query().addCriteria(new Criteria("id").is(node.getId()));
					bops.remove(query);
				}
			}

			if (ok(bops)) {
				BulkWriteResult results = bops.execute();
				log.debug("Orphans Deleted: " + results.getDeletedCount());
			}

			// if no deletes were done, break out of while loop and return.
			if (deleteCount == 0) {
				break;
			}
		}

		log.debug("TOTAL ORPHANS DELETED=" + orphanCount);
		// nodeCount = read.getNodeCount(null);
		// log.debug("final Node Count: " + nodeCount);
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

		for (String nodeId : req.getNodeIds()) {
			// lookup the node we're going to delete
			SubNode node = read.getNode(ms, nodeId);
			if (no(node))
				continue;

			// back out the number of bytes it was using
			if (!ms.isAdmin()) {
				/*
				 * NOTE: There is no equivalent to this on the IPFS code path for deleting ipfs becuase since we
				 * don't do reference counting we let the garbage collecion cleanup be the only way user quotas are
				 * deducted from
				 */
				user.addNodeBytesToUserNodeBytes(ms, node, userNode, -1);
			}

			// to directly delete a node by it's specified ID the user doing the delete must own it, or be admin
			if (ms.isAdmin() || auth.ownedByThreadUser(node)) {
				// lazy create bulkOps
				if (no(bops)) {
					bops = ops.bulkOps(BulkMode.UNORDERED, SubNode.class);
				}

				// really need a 'hasForeignShares' here to ignore if there aren't any (todo-1)
				if (ok(node.getAc())) {
					nodes.add(node);
				}

				Query query = new Query().addCriteria(new Criteria("id").is(node.getId()));
				bops.remove(query);
			}
		}

		// in async thread send out all the deletes to the foreign servers.
		exec.run(() -> {
			nodes.forEach(n -> {
				apub.sendActPubForNodeDelete(ms, snUtil.getIdBasedUrl(n), snUtil.cloneAcl(n));
				BulkOperations childOps = null;

				// Now Query the entire subgraph of this deleted node 'n'
				for (SubNode child : read.getSubGraph(ms, n, null, 0, false, false)) {
					/*
					 * NOTE: Disabling this ability to recursively delete from foreign servers because I'm not sure they
					 * won't interpret that as a DDOS attack if this happens to be a large delete underway. This will
					 * take some thought, to engineer where perhaps we limit to just 10, and do them over a period of 10
					 * minutes even, and that kind of thing, but for now we can just get by without this capability
					 */
					// apub.sendActPubForNodeDelete(ms, snUtil.getIdBasedUrl(child), snUtil.cloneAcl(child));

					// lazy instantiate
					if (no(childOps)) {
						childOps = ops.bulkOps(BulkMode.UNORDERED, SubNode.class);
					}

					Query query = new Query().addCriteria(new Criteria("id").is(child.getId()));
					childOps.remove(query);
				}

				// deletes all nodes in this subgraph branch
				if (ok(childOps)) {
					BulkWriteResult results = childOps.execute();
					log.debug("SubGraph of " + n.getIdStr() + " Nodes Deleted: " + results.getDeletedCount());
				}
			});
		});

		if (ok(bops)) {
			BulkWriteResult results = bops.execute();
			log.debug("Nodes Deleted: " + results.getDeletedCount());
		}

		update.saveSession(ms);
		res.setSuccess(true);
		return res;
	}
}
