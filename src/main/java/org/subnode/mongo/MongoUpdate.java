package org.subnode.mongo;

import java.util.LinkedList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;
import org.subnode.model.client.PrivilegeType;
import org.subnode.mongo.model.SubNode;

/**
 * Utilities related to management of the JCR Repository
 */
@Component
public class MongoUpdate {
	private static final Logger log = LoggerFactory.getLogger(MongoUpdate.class);

	@Autowired
	private MongoTemplate ops;
    
    @Autowired
    private MongoAuth auth;

	public void save(MongoSession session, SubNode node) {
		save(session, node, true);
	}

	public void save(MongoSession session, SubNode node, boolean allowAuth) {
		if (allowAuth) {
			auth.auth(session, node, PrivilegeType.WRITE);
		}
		// log.debug("MongoApi.save: DATA: " + XString.prettyPrint(node));
		ops.save(node);
		MongoThreadLocal.clean(node);
	}

    public void saveSession(MongoSession session) {
		if (session == null || session.saving || !MongoThreadLocal.hasDirtyNodes())
			return;

		try {
			// we check the saving flag to ensure we don't go into circular recursion here.
			session.saving = true;

			synchronized (session) {
				// recheck hasDirtyNodes again after we get inside the lock.
				if (!MongoThreadLocal.hasDirtyNodes()) {
					return;
				}

				/*
				 * We use 'nodes' list to avoid a concurrent modification excption in the loop
				 * below that deletes nodes, because each time we delete a node we remove it
				 * from the 'dirtyNodes' on the threadlocals
				 */
				List<SubNode> nodes = new LinkedList<SubNode>();

				/*
				 * check that we are allowed to write all, before we start writing any
				 */
				for (SubNode node : MongoThreadLocal.getDirtyNodes().values()) {
					auth.auth(session, node, PrivilegeType.WRITE);
					nodes.add(node);
				}

				for (SubNode node : nodes) {
					// log.debug("saveSession: Saving Dirty. nodeId=" + node.getId().toHexString());
					save(session, node, false);
				}
			}
		} finally {
			session.saving = false;
		}
	}

}