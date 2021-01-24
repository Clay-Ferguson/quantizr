package org.subnode.mongo;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;
import com.mongodb.client.result.DeleteResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import org.subnode.mongo.model.SubNode;
import org.subnode.service.AttachmentService;

/**
 * Utilities related to management of the JCR Repository
 */
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
	private MongoRead read;

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

		/*
		 * todo-0: we need to also include a condition for create time being over 30m ago to avoid blowing
		 * something away that someone is still using. We are ok for now, because this code only runs at app
		 * startup so we can be guaranteed that unfortunately anyone who was editing when the server got
		 * restarted already suffered some bad luck.
		 */
		query.addCriteria(Criteria.where(SubNode.FIELD_MODIFY_TIME).is(null));

		DeleteResult res = ops.remove(query, SubNode.class);
		log.debug("Num abandoned nodes deleted: " + res.getDeletedCount());
	}

	public void cleanupOldTempNodesForUser(MongoSession session, SubNode userNode) {
		Query query = new Query();

		LocalDate ldt = LocalDate.now().minusDays(5);
		Date date = Date.from(ldt.atStartOfDay(ZoneId.systemDefault()).toInstant());

		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexDirectChildrenOfPath(userNode.getPath())) //
				.and(SubNode.FIELD_MODIFY_TIME).lt(date); //

		// once we've had the TEMP prop in place for 7 days, we can then process this code from the
		// root path of all users rather than running it once on each foreign user node, and remove
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
	 * Currently cleaning up GridFS orphans is done in gridMaintenanceScan() only.
	 * 
	 * todo-2: However, it would be better if we have the 'path' stored in the GridFS metadata so we can
	 * use a 'regex' query to delete all the binaries (recursively under any node, using that path
	 * prefix as the criteria) which is exacly like the one below for deleting the nodes themselves.
	 */
	public void delete(MongoSession session, SubNode node, boolean childrenOnly) {
		auth.authRequireOwnerOfNode(session, node);
		log.debug("Deleting under path: " + node.getPath());

		/*
		 * we save the session to be sure there's no conflicting between what cached changes might be
		 * flagged as dirty that might be about to be deleted.
		 * 
		 * todo-1: potential optimization: just clear from the cache any nodes that have a path starting
		 * with 'node.getPath()', and leave the rest in the cache. But this will be rare that it has any
		 * performance impact.
		 */
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

		/*
		 * Yes we DO have to remove the node itself separate from the remove of all it's subgraph, because
		 * in order to be perfectly safe the recursive subgraph regex MUST designate the slash AFTER the
		 * root path to be sure we get the correct node, other wise deleting /ab would also delete /abc for
		 * example. so we must have our recursive delete identify deleting "/ab" as starting with "/ab/"
		 */
		if (!childrenOnly) {
			ops.remove(node);
		}
	}
}
