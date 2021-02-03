package org.subnode.service;

import java.util.LinkedList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.subnode.model.NodeInfo;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.GetSharedNodesRequest;
import org.subnode.request.NodeSearchRequest;
import org.subnode.response.GetSharedNodesResponse;
import org.subnode.response.NodeSearchResponse;
import org.subnode.util.Convert;
import org.subnode.util.ThreadLocals;

/**
 * Service for searching the repository. This searching is currently very basic, and just grabs the
 * first 100 results. Despite it being basic right now, it is however EXTREMELY high performance and
 * leverages the full and best search performance that can be gotten out of Lucene, which beats any
 * other technology in the world in it's power.
 * 
 * NOTE: the Query class DOES have a 'skip' and 'limit' which I can take advantage of in all my
 * searching but I'm not fully doing so yet I don't believe.
 */
@Component
public class NodeSearchService {
	private static final Logger log = LoggerFactory.getLogger(NodeSearchService.class);

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoAuth auth;

	@Autowired
	private Convert convert;

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
			SubNode node = read.getNode(session, searchText, true);
			if (node != null) {
				NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSessionContext(), session, node, true, false,
						counter + 1, false, false);
				searchResults.add(info);
			}
		} else if ("node.name".equals(req.getSearchProp())) {
			if (ThreadLocals.getSessionContext().isAdmin()) {
				searchText = ":" + searchText;
			} else {
				searchText = ":" + ThreadLocals.getSessionContext().getUserName() + ":" + searchText;
			}
			SubNode node = read.getNode(session, searchText, true);
			if (node != null) {
				NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSessionContext(), session, node, true, false,
						counter + 1, false, false);
				searchResults.add(info);
			}
		}
		// othwerwise we're searching all node properties, only under the selected node.
		else {
			SubNode searchRoot = read.getNode(session, req.getNodeId());

			for (SubNode node : read.searchSubGraph(session, searchRoot, req.getSearchProp(), searchText, req.getSortField(),
					MAX_NODES, req.getFuzzy(), req.getCaseSensitive())) {
		
				NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSessionContext(), session, node, true, false,
						counter + 1, false, false);
				searchResults.add(info);
				if (counter++ > MAX_NODES) {
					break;
				}
			}
		}
		res.setSuccess(true);
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

		// DO NOT DELETE (may want searching under selected node as an option some day)
		// we can remove nodeId from req, because we always search from account root now.
		// SubNode searchRoot = api.getNode(session, req.getNodeId());

		// search under account root only
		SubNode searchRoot = read.getNode(session, ThreadLocals.getSessionContext().getRootId());

		/*
		 * todo-1: Eventually we want two ways of searching here. 1) All my shared nodes under my account,
		 * 2) all my shared nodes globally, and the globally is done simply by passing null for the path
		 * here
		 */
		for (SubNode node : auth.searchSubGraphByAcl(session, searchRoot.getPath(), searchRoot.getOwner(),
				Sort.by(Sort.Direction.DESC, SubNode.FIELD_MODIFY_TIME), MAX_NODES)) {

			/*
			 * If we're only looking for shares to a specific person (or public) then check here
			 */
			if (req.getShareTarget() != null && !node.safeGetAc().containsKey(req.getShareTarget())) {
				continue;
			}

			NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSessionContext(), session, node, true, false, counter + 1,
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
