package org.subnode.service;

import java.util.HashMap;
import java.util.Set;

import org.subnode.config.NodeName;
import org.subnode.config.SessionContext;
import org.subnode.mail.OutboxMgr;
import org.subnode.model.NodeInfo;
import org.subnode.model.UserFeedInfo;
import org.subnode.model.UserFeedItem;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoAppConfig;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.mongo.model.SubNode;
import org.subnode.response.FeedPushInfo;
import org.subnode.response.ServerPushInfo;
import org.subnode.util.Convert;
import org.subnode.util.ValContainer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Service methods for maintaining 'in-memory' lists of the most recent UserFeed
 * posts of all users, to allow extremely fast construction of any person's
 * consolidated feed.
 */
@Component
public class UserFeedService {
	private static final Logger log = LoggerFactory.getLogger(UserFeedService.class);

	@Autowired
	private MongoAppConfig mac;

	@Autowired
	private MongoApi api;

	@Autowired
	private RunAsMongoAdmin adminRunner;

	@Autowired
	private OutboxMgr outboxMgr;

	@Autowired
	private Convert convert;

	/* Map key is userName */
	static HashMap<String, UserFeedInfo> userFeedInfoMapByUserName = new HashMap<String, UserFeedInfo>();

	/*
	 * Map to allow ability to lookup any UserFeedInfo by the path of the feed node,
	 * so the key is the path
	 */
	static HashMap<String, UserFeedInfo> userFeedInfoMapByPath = new HashMap<String, UserFeedInfo>();

	public void init() {
		log.debug("UserFeedService.init()");
		processAllUsers();
	}

	private void processAllUsers() {
		userFeedInfoMapByUserName.clear();
		userFeedInfoMapByPath.clear();

		adminRunner.run(session -> {
			Iterable<SubNode> accountNodes = api.getChildrenUnderParentPath(session, NodeName.ROOT_OF_ALL_USERS, null,
					null);

			for (SubNode accountNode : accountNodes) {
				String userName = accountNode.getStringProp(NodeProp.USER);
				log.debug("User " + userName + ". NodeId=" + accountNode.getId().toHexString());
				addUserFeedInfo(session, accountNode, userName);
			}
		});
	}

	private void addUserFeedInfo(MongoSession session, SubNode accountNode, String userName) {
		UserFeedInfo userFeedInfo = null;

		SubNode feedNode = api.findTypedNodeUnderPath(session, accountNode.getPath(), NodeType.USER_FEED.s());
		if (feedNode != null) {
			log.debug("Found UserFeed Node to get Timeline of: " + feedNode.getId().toHexString());

			for (SubNode node : api.searchSubGraph(session, feedNode, null, "", SubNode.FIELD_MODIFY_TIME, 10, false,
					false)) {

				// lazily create the object
				if (userFeedInfo == null) {
					userFeedInfo = new UserFeedInfo();
				}

				userFeedInfo.setUserName(userName);

				UserFeedItem userFeedItem = new UserFeedItem();
				userFeedItem.setNodeId(node.getId());
				userFeedItem.setModTime(node.getModifyTime());
				userFeedItem.setNode(node);
				userFeedInfo.getUserFeedList().add(userFeedItem);

				log.debug("UserFeed ITEM: " + node.getId().toHexString());
			}
		}

		if (userFeedInfo != null) {
			userFeedInfoMapByUserName.put(userName, userFeedInfo);
			userFeedInfoMapByPath.put(feedNode.getPath(), userFeedInfo);
		}
	}

	/*
	 * Our MongEventListener calls this every time a node is saved to give us a
	 * chance to see if it's a child (or decendent at any level deep) of a feed
	 * node, and needs to be cached as a userFeedItem
	 */
	public void nodeSaveNotify(MongoSession session, SubNode node) {
		//log.debug("UserFeedService.nodeSaveNotify: " + node.getPath());
		/*
		 * We check the parent node, and all ancestors nodes, of 'node', to see if any
		 * of them are a feed node that we have cached because if so then we'll update
		 * our cache by adding it into the cache, and be creaful to remove it before
		 * adding it in at top so that we don't have any duplicates
		 */
		String path = node.getPath();
		while (true) {
			int lastSlashIdx = path.lastIndexOf("/");

			// if no more slashes, we're done
			if (lastSlashIdx <= 0)
				break;

			path = path.substring(0, lastSlashIdx);
			//log.debug("    subpath:" + path);
			UserFeedInfo userFeedInfo = userFeedInfoMapByPath.get(path);
			if (userFeedInfo != null) {
				ensureNodeInUserFeedInfo(session, userFeedInfo, node);
				break;
			}
		}
	}

	/*
	 * Ensure the 'node' is in the userFeedInfo by creating or updating if it
	 * already is there
	 */
	private void ensureNodeInUserFeedInfo(MongoSession session, UserFeedInfo userFeedInfo, SubNode node) {
		UserFeedItem userFeedItem = null;

		// first scan to see if we already have a userFeedItem for this node
		for (UserFeedItem ufi : userFeedInfo.getUserFeedList()) {
			if (ufi.getNodeId().equals(node.getId())) {
				userFeedItem = ufi;
				break;
			}
		}

		if (userFeedItem == null) {
			userFeedItem = new UserFeedItem();
			userFeedItem.setNodeId(node.getId());
			userFeedInfo.getUserFeedList().add(userFeedItem);
		}

		userFeedItem.setModTime(node.getModifyTime());
		userFeedItem.setNode(node);

		pushNodeUpdateToAllFriends(session, node);
	}

	/*
	 * This will result in a push that makes everyone following the owner of node
	 * (as one of their friends), have their feed information updated in realtime in
	 * their browser without even requiring a database query of any kind
	 */
	private void pushNodeUpdateToAllFriends(MongoSession session, SubNode node) {

		Set<String> keys = null;

		/*
		 * all we do in this synchronized block is get keys because we need to release
		 * this lock FAST since it has the effect of making logins or other critical
		 * processes block while locked
		 */
		synchronized (SessionContext.allSessions) {
			keys = SessionContext.allSessions.keySet();
		}

		ValContainer<NodeInfo> nodeInfoVal = new ValContainer<NodeInfo>();

		for (String key : keys) {
			SessionContext sessionContext = SessionContext.allSessions.get(key);
			if (sessionContext != null) {
				if (sessionContext.getFeedUserNodeIds() != null
						&& sessionContext.getFeedUserNodeIds().contains(node.getOwner().toHexString())) {
					//log.debug("USER NEED A PUSH: " + sessionContext.getUserName());

					// lazily create the info val
					if (nodeInfoVal.getVal() == null) {
						nodeInfoVal.setVal(convert.convertToNodeInfo(sessionContext, session, node, true, false, 1,
								false, false, false));
					}

					outboxMgr.sendServerPushInfo(sessionContext.getUserName(), new FeedPushInfo(nodeInfoVal.getVal()));
				}
			}
		}
	}
}
