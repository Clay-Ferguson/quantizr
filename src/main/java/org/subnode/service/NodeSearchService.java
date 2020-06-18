package org.subnode.service;

import java.text.SimpleDateFormat;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import org.subnode.config.SessionContext;
import org.subnode.model.NodeInfo;
import org.subnode.model.UserFeedInfo;
import org.subnode.model.UserFeedItem;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.GetSharedNodesRequest;
import org.subnode.request.NodeFeedRequest;
import org.subnode.request.NodeSearchRequest;
import org.subnode.response.GetSharedNodesResponse;
import org.subnode.response.NodeFeedResponse;
import org.subnode.response.NodeSearchResponse;
import org.subnode.util.Convert;
import org.subnode.util.DateUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.ValContainer;

/**
 * Service for searching the repository. This searching is currently very basic,
 * and just grabs the first 100 results. Despite it being basic right now, it is
 * however EXTREMELY high performance and leverages the full and best search
 * performance that can be gotten out of Lucene, which beats any other
 * technology in the world in it's power.
 * 
 * NOTE: the Query class DOES have a 'skip' and 'limit' which I can take
 * advantage of in all my searching but I'm not fully doing so yet I don't
 * believe.
 */
@Component
public class NodeSearchService {
	private static final Logger log = LoggerFactory.getLogger(NodeSearchService.class);
	private SimpleDateFormat dateFormat = new SimpleDateFormat(DateUtil.DATE_FORMAT_NO_TIMEZONE,
			DateUtil.DATE_FORMAT_LOCALE);

	@Autowired
	private MongoApi api;

	@Autowired
	private Convert convert;

	@Autowired
	private SessionContext sessionContext;

	@Autowired
	private RunAsMongoAdmin adminRunner;

	@Autowired
	private UserFeedService userFeedService;

	public NodeSearchResponse search(MongoSession session, NodeSearchRequest req) {
		NodeSearchResponse res = new NodeSearchResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		int MAX_NODES = 100;

		String searchText = req.getSearchText();

		List<NodeInfo> searchResults = new LinkedList<NodeInfo>();
		res.setSearchResults(searchResults);
		int counter = 0;

		if ("node.id".equals(req.getSearchProp())) {
			SubNode node = api.getNode(session, req.getSearchText(), true);
			if (node != null) {
				NodeInfo info = convert.convertToNodeInfo(sessionContext, session, node, true, false, counter + 1,
						false, false, false);
				searchResults.add(info);
			}
		}
		/*
		 * node.name is a special indicator meaning we're doing a node name lookup. Not
		 * a fuzzy search but an exact lookup.
		 */
		else if ("node.name".equals(req.getSearchProp())) {
			SubNode node = api.getNode(session, ":" + req.getSearchText(), true);
			if (node != null) {
				NodeInfo info = convert.convertToNodeInfo(sessionContext, session, node, true, false, counter + 1,
						false, false, false);
				searchResults.add(info);
			}
		}
		// othwerwise we're searching all node properties, only under the selected node.
		else {
			SubNode searchRoot = api.getNode(session, req.getNodeId());

			for (SubNode node : api.searchSubGraph(session, searchRoot, req.getSearchProp(), searchText,
					req.getSortField(), MAX_NODES, req.getFuzzy(), req.getCaseSensitive())) {
				// log.debug("NodeFound: node: "+ XString.prettyPrint(node));
				NodeInfo info = convert.convertToNodeInfo(sessionContext, session, node, true, false, counter + 1,
						false, false, false);
				searchResults.add(info);
				if (counter++ > MAX_NODES) {
					break;
				}
			}
		}
		res.setSuccess(true);
		log.debug("search results count: " + counter);
		return res;
	}

	/*
	 * req.is is expected to be a FRIEND_LIST node with FRIEND types under it, and
	 * we generate a feed based on that set of friends to then display in the feed
	 * tab.
	 */
	public NodeFeedResponse nodeFeed(MongoSession session, NodeFeedRequest req) {
		/*
		 * todo-0: This is TEMPORARY, we will end up keeping userFeedService up to date
		 * another way later. For now we could at least add an admin menu option to run this on demand ?
		 */
		//userFeedService.init();

		NodeFeedResponse res = new NodeFeedResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		int MAX_NODES = 100;
		int counter = 0;

		SubNode feedNode = api.getNode(session, req.getNodeId());
		if (feedNode != null) {
			if (!feedNode.getType().equals(NodeType.FRIEND_LIST.s())) {
				throw new RuntimeException("only FRIEND_LIST type nodes can generate a feed.");
			}

			Iterable<SubNode> friendNodes = api.getChildrenUnderParentPath(session, feedNode.getPath(), null,
					MAX_NODES);

			List<UserFeedItem> fullFeedList = new LinkedList<UserFeedItem>();

			/*
			 * we store the set of the currently active userNodeIds in the session, so that
			 * directly from the user's session memory we can tell who all the users are in
			 * the feed they are now viewing
			 */
			HashSet<String> userNodeIds = new HashSet<String>();

			//We have to add in ourselves here so that we get our own feed updated per our own posts */
			userNodeIds.add(sessionContext.getRootId());

			for (SubNode friendNode : friendNodes) {
				String userName = null;
				String userNodeId = friendNode.getStringProp(NodeProp.USER_NODE_ID.s());
				userNodeIds.add(userNodeId);

				/*
				 * when user first adds, this friendNode won't have the userNodeId yet, so add
				 * if not yet existing
				 */
				if (userNodeId == null) {
					userName = friendNode.getStringProp(NodeProp.USER.s());

					// if USER_NODE_ID has not been set on the node yet then get it and set it first
					// here.
					if (userName != null) {
						ValContainer<SubNode> _userNode = new ValContainer<SubNode>();
						final String _userName = userName;
						adminRunner.run(s -> {
							_userNode.setVal(api.getUserNodeByUserName(s, _userName));
						});

						if (_userNode.getVal() != null) {
							userNodeId = _userNode.getVal().getId().toHexString();
							friendNode.setProp(NodeProp.USER_NODE_ID.s(), userNodeId);
						}
					}
				} else {
					userName = friendNode.getStringProp(NodeProp.USER.s());
				}

				/*
				 * Look up the cached User Feed nodes (in memory) and add all of 'userName'
				 * cached items into the full feed list
				 */
				synchronized (UserFeedService.userFeedInfoMapByUserName) {
					UserFeedInfo userFeedInfo = UserFeedService.userFeedInfoMapByUserName.get(userName);
					if (userFeedInfo != null) {
						fullFeedList.addAll(userFeedInfo.getUserFeedList());
					}
				}

				log.debug("Processing Friend Node[" + userName + "]: id=" + friendNode.getId().toHexString());
			}

			/*
			 * Now add the feed of the current user because a user should be able to see his
			 * own posts appear in the feed
			 */
			synchronized (UserFeedService.userFeedInfoMapByUserName) {
				UserFeedInfo userFeedInfo = UserFeedService.userFeedInfoMapByUserName.get(sessionContext.getUserName());
				if (userFeedInfo != null) {
					fullFeedList.addAll(userFeedInfo.getUserFeedList());
				}
			}

			/* Sort the feed items chrononologially */
			Collections.sort(fullFeedList, new Comparator<UserFeedItem>() {
				@Override
				public int compare(UserFeedItem s1, UserFeedItem s2) {
					return (int) (s2.getModTime().getTime() - s1.getModTime().getTime());
				}
			});

			/*
			 * Generate the final presentation info objects to send back to client (NodeInfo
			 * list)
			 */
			List<NodeInfo> results = new LinkedList<NodeInfo>();
			for (UserFeedItem ufi : fullFeedList) {
				NodeInfo info = convert.convertToNodeInfo(sessionContext, session, ufi.getNode(), true, false,
						counter + 1, false, false, false);
				results.add(info);
				if (counter++ > MAX_NODES) {
					break;
				}
			}

			res.setSearchResults(results);
			res.setSuccess(true);

			sessionContext.setFeedUserNodeIds(userNodeIds);

			// log.debug("feed count: " + counter);
		}
		return res;
	}

	public GetSharedNodesResponse getSharedNodes(MongoSession session, GetSharedNodesRequest req) {
		GetSharedNodesResponse res = new GetSharedNodesResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		int MAX_NODES = 100;

		List<NodeInfo> searchResults = new LinkedList<NodeInfo>();
		res.setSearchResults(searchResults);
		int counter = 0;

		SubNode searchRoot = api.getNode(session, req.getNodeId());

		for (SubNode node : api.searchSubGraphByAcl(session, searchRoot, SubNode.FIELD_MODIFY_TIME, MAX_NODES)) {

			/*
			 * If we're only looking for shares to a specific person (or public) then check
			 * here
			 */
			if (req.getShareTarget() != null && !node.getAc().containsKey(req.getShareTarget())) {
				continue;
			}

			NodeInfo info = convert.convertToNodeInfo(sessionContext, session, node, true, false, counter + 1, false,
					false, false);
			searchResults.add(info);
			if (counter++ > MAX_NODES) {
				break;
			}
		}

		res.setSuccess(true);
		log.debug("search results count: " + counter);
		return res;
	}
}
