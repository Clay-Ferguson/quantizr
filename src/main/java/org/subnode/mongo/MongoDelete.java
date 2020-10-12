package org.subnode.mongo;

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
	private MongoUtil util;

	public void deleteNode(MongoSession session, SubNode node, boolean childrenOnly) {
		if (!childrenOnly) {
			attachmentService.deleteBinary(session, node);
		}
		delete(session, node, childrenOnly);
	}

	/**
	 * 2: cleaning up GridFS will be done as an async thread. For now we can just
	 * let GridFS binaries data get orphaned... BUT I think it might end up being
	 * super efficient if we have the 'path' stored in the GridFS metadata so we can
	 * use a 'regex' query to delete all the binaries which is exacly like the one
	 * below for deleting the nodes themselves.
	 * 
	 */
	public void delete(MongoSession session, SubNode node, boolean childrenOnly) {
		auth.authRequireOwnerOfNode(session, node);

		log.debug("Deleting under path: " + node.getPath());

		/*
		 * we save the session to be sure there's no conflicting between what cached
		 * changes might be flagged as dirty that might be about to be deleted.
		 * 
		 * todo-1: potential optimization: just clear from the cache any nodes that have
		 * a path starting with 'node.getPath()', and leave the rest in the cache. But
		 * this will be rare that it has any performance impact.
		 */
		update.saveSession(session);

		/*
		 * First delete all the children of the node by using the path, knowing all
		 * their paths 'start with' (as substring) this path. Note how efficient it is
		 * that we can delete an entire subgraph in one single operation! Nice!
		 */
		Query query = new Query();
		query.addCriteria(Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(node.getPath())));

		DeleteResult res = ops.remove(query, SubNode.class);
		log.debug("Num of SubGraph deleted: " + res.getDeletedCount());

		/*
		 * Yes we DO have to remove the node itself separate from the remove of all it's
		 * subgraph, because in order to be perfectly safe the recursive subgraph regex
		 * MUST designate the slash AFTER the root path to be sure we get the correct
		 * node, other wise deleting /ab would also delete /abc for example. so we must
		 * have our recursive delete identify deleting "/ab" as starting with "/ab/"
		 */
		if (!childrenOnly) {
			ops.remove(node);
		}
	}
}