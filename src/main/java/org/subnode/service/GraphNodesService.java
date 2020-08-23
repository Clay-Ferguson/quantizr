package org.subnode.service;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.StringTokenizer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import org.subnode.config.SessionContext;
import org.subnode.model.GraphEdge;
import org.subnode.model.GraphNode;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.GraphRequest;
import org.subnode.response.GraphResponse;
import org.subnode.util.ExUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;

@Component
public class GraphNodesService {
	private static final Logger log = LoggerFactory.getLogger(GraphNodesService.class);

	@Autowired
	private MongoApi api;

	private static final int MAX_NODES = 500;

	class GenerateContext {
		//we use this to basically compress data. We converte a unique set of strings to another
		//unique of 'shorter' strings where the shorter ones are a simple sequence
		public HashMap<String, String> numOfString = new HashMap<String,String>();
		public int nodeCount = 0;

		/*
		 * map of all GraphNodes that go created for "tags", and the key in this map is
		 * the tag itself
		 */
		public HashMap<String, GraphNode> tagNodes = new HashMap<String, GraphNode>();

		public String getNumOfString(String val) {
			String numStr = numOfString.get(val);
			if (numStr!=null) {
				return numStr;
			}
			numOfString.put(val, numStr = String.valueOf(numOfString.size()+1));
			return numStr;
		}
	}

	public GraphResponse graphNodes(MongoSession session, GraphRequest req) {
		GraphResponse res = new GraphResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		res.setNodes(new LinkedList<GraphNode>());
		res.setEdges(new LinkedList<GraphEdge>());

		SubNode node = api.getNode(session, req.getNodeId(), true);
		try {
			log.debug("Graphing Node: " + node.getPath());

			GenerateContext ctx = new GenerateContext();
			recurseNode(ctx, res, session, null, node, 0);
		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		}

		res.setSuccess(true);
		return res;
	}

	// private void graphTags(MongoSession session, SubNode node) {
	// int MAX_NODES = 1000;
	// SubNode searchRoot = api.getNode(session, node.getId().toHexString());

	// String searchText = null; //"[nonempty]";
	// //OOPS: sn:tags is not a property directly on SubNode because it's in a
	// collection (prp) and cannot therefore be searched
	// for (SubNode n : api.searchSubGraph(session, searchRoot, "sn:tags",
	// searchText, "", MAX_NODES)) {
	// foundNode(n);
	// }
	// }

	private void recurseNode(GenerateContext ctx, GraphResponse res, MongoSession session, SubNode parent, SubNode node,
			int level) {
		
		if (node == null)
			return;

		/* process the current node */
		processNode(ctx, res, parent, node);

		for (SubNode n : api.getChildren(session, node, null, null)) {
			recurseNode(ctx, res, session, node, n, level + 1);
			if (ctx.nodeCount >= MAX_NODES) {
				return;
			}
		}
	}

	private void processNode(GenerateContext ctx, GraphResponse res, SubNode parent, SubNode node) {
		String nodeId = XString.lastNChars(node.getId().toHexString(), 5);
		String nodeIdNum = ctx.getNumOfString(nodeId);
		String parentId = parent==null ? null : XString.lastNChars(parent.getId().toHexString(), 5);

		String tags = node.getStringProp("sn:tags");
		if (tags != null) {
			StringTokenizer t = new StringTokenizer(tags, " ", false);

			// split apart all the tokens using space as delimiter
			while (t.hasMoreTokens()) {
				String tag = t.nextToken().trim();

				// look up GrapNode if it might already exist
				GraphNode graphNode = ctx.tagNodes.get(tag);

				String tagId = ctx.getNumOfString(tag);

				// if GraphNode didn't exist, create and put it in the map
				if (graphNode == null) {
					graphNode = new GraphNode(tagId, tag);
					ctx.nodeCount++;
					res.getNodes().add(graphNode);
					ctx.tagNodes.put(tag, graphNode);
				}

				// add the connection of this node onto the tag node.
				res.getEdges().add(new GraphEdge(tagId, nodeIdNum));
			}
		}

		String label = null;
		String content = node.getContent();
		if (content!=null) {
			if (content.length() > 40) {
			label = content.substring(0, 40);
			}
			else {
				label = content;
			}
		}
		else {
			label = nodeId;
		}

		//compress nodeId into a shorter unique val.
		nodeId = ctx.getNumOfString(nodeId);
		parentId = ctx.getNumOfString(parentId);

		res.getNodes().add(new GraphNode(nodeId, label));
		ctx.nodeCount++;
		if (parent != null) {
			res.getEdges().add(new GraphEdge(parentId, nodeId));
		}
	}
}

