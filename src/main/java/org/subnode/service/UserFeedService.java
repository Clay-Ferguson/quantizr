package org.subnode.service;

import java.util.HashMap;
import org.subnode.config.NodeName;
import org.subnode.model.UserFeedInfo;
import org.subnode.model.UserFeedItem;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoAppConfig;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.mongo.model.SubNode;
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

	/* Map key is userName */
	static HashMap<String, UserFeedInfo> userFeedInfoMap = new HashMap<String, UserFeedInfo>();

	public void init() {
		log.debug("UserFeedService.init()");
		processAllUsers();
	}

	private void processAllUsers() {
		userFeedInfoMap.clear();

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
				// todo-0: is it more efficient to store Object id here instead of string?
				userFeedItem.setNodeId(node.getId());
				userFeedItem.setModTime(node.getModifyTime());
				userFeedItem.setNode(node);
				userFeedInfo.getUserFeedList().add(userFeedItem);

				log.debug("UserFeed ITEM: " + node.getId().toHexString());
			}
		}

		if (userFeedInfo != null) {
			userFeedInfoMap.put(userName, userFeedInfo);
		}
	}
}
