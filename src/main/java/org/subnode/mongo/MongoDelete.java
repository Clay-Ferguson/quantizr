package org.subnode.mongo;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;
import java.util.HashSet;
import com.mongodb.client.result.DeleteResult;
import org.apache.commons.codec.digest.DigestUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.model.SubNode;
import org.subnode.service.AttachmentService;

@Component
public class MongoDelete {
	private static final Logger log = LoggerFactory.getLogger(MongoDelete.class);

	@Autowired
	private MongoTemplate ops;

	@Autowired
	private AttachmentService attachmentService;

	@Autowired
	private MongoUpdate update;

	@Autowired
	private MongoAuth auth;

	@Autowired
	private MongoUtil util;

	public void deleteNode(MongoSession session, SubNode node, boolean childrenOnly) {
		if (!childrenOnly) {
			attachmentService.deleteBinary(session, "", node, null);
		}
		delete(session, node, childrenOnly);
	}

	/*
	 * When a user is creating a new node we leave FIELD_MODIFY_TIME null until their first save of it
	 * and during the time it's null no other users can see the node. However the user can also abandon
	 * the browser or cancel the editing and orphan the node that way, and this method which we call
	 * only at startup, cleans up any and all of the orphans
	 */
	public void removeAbandonedNodes(MongoSession session) {
		Query query = new Query();
		query.addCriteria(Criteria.where(SubNode.FIELD_MODIFY_TIME).is(null));

		DeleteResult res = ops.remove(query, SubNode.class);
		log.debug("Num abandoned nodes deleted: " + res.getDeletedCount());
	}

	/**
	 * Deletes old activity pub posts, just to save space on our server. This destroys perfectly good
	 * data so we need to make it an admin option (todo-1)
	 */
	public long deleteOldActPubPosts(SubNode parent, MongoSession session) {
		Query query = new Query();

		// date 30 days ago.
		LocalDate ldt = LocalDate.now().minusDays(30);
		Date date = Date.from(ldt.atStartOfDay(ZoneId.systemDefault()).toInstant());

		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(parent.getPath())) //
				.and(SubNode.FIELD_PROPERTIES + "." + NodeProp.ACT_PUB_ID + ".value").ne(null) //
				.and(SubNode.FIELD_MODIFY_TIME).lt(date);

		query.addCriteria(criteria);
		DeleteResult res = ops.remove(query, SubNode.class);
		return res.getDeletedCount();
	}

	/* This is a way to cleanup old records, but it's needed yet */
	public void cleanupOldTempNodesForUser(MongoSession session, SubNode userNode) {
		Query query = new Query();

		LocalDate ldt = LocalDate.now().minusDays(5);
		Date date = Date.from(ldt.atStartOfDay(ZoneId.systemDefault()).toInstant());

		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(userNode.getPath())) //
				.and(SubNode.FIELD_MODIFY_TIME).lt(date); //

		// once we've had the TEMP prop in place for 7 days, we can then process this
		// code from the
		// root path of all users rather than running it once on each foreign user node,
		// and remove
		// 'ForUser' from method name
		// and(SubNode.FIELD_PROPERTIES + "." + NodeProp.TEMP.s() + ".value").ne(null));

		query.addCriteria(criteria);

		// Example: Time Range check:
		// query.addCriteria(Criteria.where("startDate").gte(startDate).lt(endDate));

		DeleteResult res = ops.remove(query, SubNode.class);
		if (res.getDeletedCount() > 0) {
			log.debug("Temp Records Deleted (Under User: " + userNode.getId().toHexString() + "): " + res.getDeletedCount());
		}
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
	public long delete(MongoSession session, SubNode node, boolean childrenOnly) {
		auth.ownerAuth(session, node);
		log.debug("Deleting under path: " + node.getPath());

		update.saveSession(session);

		/*
		 * First delete all the children of the node by using the path, knowing all their paths 'start with'
		 * (as substring) this path. Note how efficient it is that we can delete an entire subgraph in one
		 * single operation! Nice!
		 */
		Query query = new Query();
		query.addCriteria(Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(node.getPath())));

		DeleteResult res = ops.remove(query, SubNode.class);
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

	public void delete(SubNode node) {
		ops.remove(node);
	}

	/*
	 * This algorithm requires one hash value of memory for every non-leaf node in the DB to run so it's
	 * very fast but at the cost of memory use
	 */
	public void deleteNodeOrphans(MongoSession session) {
		log.debug("deleteNodeOrphans()");
		// long nodeCount = read.getNodeCount(null);
		// log.debug("initial Node Count: " + nodeCount);

		HashSet<String> pathHashSet = new HashSet<>();
		if (session == null) {
			session = auth.getAdminSession();
		}

		Query query = new Query();

		/* Scan every node in the database and store it's path hash in the set */
		Iterable<SubNode> nodes = util.find(query);
		for (SubNode node : nodes) {
			/*
			 * Theoretically the node.getPathHash() should already contain this hash, but to be super paranoid
			 * we just recalculate that hash here since the consequences of it being out of sync could be data
			 * loss.
			 */
			pathHashSet.add(DigestUtils.sha256Hex(node.getPath()));
		}

		int orphanCount = 0;
		int loops = 0;

		/*
		 * Run this up to 10 per call. Note that for large orphaned subgraphs we only end up pruning off the
		 * 10 deepest levels at a time, so running this multiple times will be required, but this is ideal.
		 * We could raise this 10 to a larger number larger than any possible tree depth, but there's no
		 * need. Running this several times has the same effect
		 */
		while (++loops < 10) {
			/*
			 * Now scan every node again and any PARENT not in the set means that parent doesn't exist and so
			 * the node is an orphan and can be deleted.
			 */
			nodes = util.find(query);
			int deleteCount = 0;
			for (SubNode node : nodes) {
				// ignore the root node and any of it's children.
				if ("/r".equalsIgnoreCase(node.getPath()) || //
						"/r".equalsIgnoreCase(node.getParentPath())) {
					continue;
				}

				if (!pathHashSet.contains(DigestUtils.sha256Hex(node.getParentPath()))) {
					log.debug("ORPHAN NODE id=" + node.getId().toHexString() + " path=" + node.getPath() + " Content="
							+ node.getContent());
					orphanCount++;
					deleteCount++;
					ops.remove(node);

					/*
					 * Theoretically the node.getPathHash() should already contain this hash, but to be super paranoid
					 * we just recalculate that hash here since the consequences of it being out of sync could be data
					 * loss. Also I do realize we alrady calculated this hash above and could have stored it in memory
					 * to use here, but we already have pathHashSet being a large memory use here, so we opt to burn
					 * more CPU cycles for this second hash calc than to burn the memory by storing it above.
					 */
					pathHashSet.remove(DigestUtils.sha256Hex(node.getPath()));
				}
			}

			// if no deletes were done, break out of while loop and return.
			if (deleteCount == 0) {
				break;
			}
		}

		log.debug("ORPHAN NODES DELETED=" + orphanCount);
		// nodeCount = read.getNodeCount(null);
		// log.debug("final Node Count: " + nodeCount);
	}
}
