package org.subnode.service;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.model.GraphNode;
import org.subnode.mongo.MongoRead;
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
	private MongoRead read;

	public GraphResponse graphNodes(MongoSession session, GraphRequest req) {
		HashMap<String, GraphNode> mapByPath = new HashMap<String, GraphNode>();
		GraphResponse res = new GraphResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		SubNode node = read.getNode(session, req.getNodeId(), true);
		GraphNode gnode = new GraphNode(node.getId().toHexString());
		String rootPath = node.getPath();
		gnode.setPath(node.getPath());
		mapByPath.put(gnode.getPath(), gnode);
		// log.debug("Root Node Path: " + node.getPath());

		try {
			for (SubNode n : read.getSubGraph(session, node)) {
				// log.debug("Node Path: " + n.getPath());
				GraphNode gn = new GraphNode(n.getId().toHexString());
				gn.setPath(n.getPath());
				mapByPath.put(gn.getPath(), gn);
			}

			processNodes(rootPath, mapByPath);
			// log.debug("Final Graph: " + XString.prettyPrint(gnode));
			res.setRootNode(gnode);
		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		}

		res.setSuccess(true);
		return res;
	}

	private void processNodes(String rootPath, HashMap<String, GraphNode> mapByPath) {
		List<GraphNode> newNodes = new LinkedList<GraphNode>();

		/*
		 * First scan to create any parents that don't exist, putting them in newNodes
		 */
		for (String path : mapByPath.keySet()) {
			if (path.equals(rootPath)) continue;

			GraphNode n = mapByPath.get(path);
			String parentPath = XString.truncateAfterLast(n.getPath(), "/");
			// log.debug("Looking for Parent(a): " + parentPath);
			GraphNode parent = mapByPath.get(parentPath);
			if (parent == null) {
				// log.debug("   creatingThatParent");
				parent = new GraphNode(parentPath);
				parent.setPath(parentPath);
				newNodes.add(parent);
			}
		}

		// add all new nodes to hash
		for (GraphNode nn : newNodes) {
			mapByPath.put(nn.getPath(), nn);
		}

		// now add all nodes to the child list of their parents.
		for (String path : mapByPath.keySet()) {
			if (path.equals(rootPath)) continue;

			GraphNode n = mapByPath.get(path);
			String parentPath = XString.truncateAfterLast(n.getPath(), "/");
			//log.debug("Looking for Parent (b): " + parentPath);
			GraphNode parent = mapByPath.get(parentPath);
			if (parent != null) {
				parent.addChild(n);
				// log.debug("Parent Name "+parent.getName()+" now has childCount="+parent.getChildren().size());
			} else {
				log.debug("Top level node??:" + n);
			}
		}
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

	// private GraphNode recurseNode(GraphResponse res, MongoSession session,
	// SubNode parent, SubNode node,
	// int level) {

	// if (node == null)
	// return null;

	// /* process the current node */
	// GraphNode gnode = processNode(res, node);
	// List<GraphNode> children = null;

	// for (SubNode n : read.getChildren(session, node, null, null, 0)) {
	// if (children==null) {
	// gnode.setChildren(children = new LinkedList<GraphNode>());
	// }

	// GraphNode gchild = recurseNode(res, session, node, n, level + 1);
	// children.add(gchild);
	// }
	// return gnode;
	// }

	private GraphNode processNode(GraphResponse res, SubNode node) {

		GraphNode gnode = new GraphNode();
		gnode.setName(node.getId().toHexString());
		return gnode;

		// String nodeId = XString.lastNChars(node.getId().toHexString(), 5);
		// String parentId = parent==null ? null :
		// XString.lastNChars(parent.getId().toHexString(), 5);

		// String tags = node.getStringProp("sn:tags");
		// if (tags != null) {
		// StringTokenizer t = new StringTokenizer(tags, " ", false);

		// // split apart all the tokens using space as delimiter
		// while (t.hasMoreTokens()) {
		// String tag = t.nextToken().trim();

		// // look up GrapNode if it might already exist
		// GraphNode graphNode = ctx.tagNodes.get(tag);

		// String tagId = ctx.getNumOfString(tag);

		// // if GraphNode didn't exist, create and put it in the map
		// if (graphNode == null) {
		// graphNode = new GraphNode(tagId, tag);
		// ctx.nodeCount++;
		// res.getNodes().add(graphNode);
		// ctx.tagNodes.put(tag, graphNode);
		// }

		// // add the connection of this node onto the tag node.
		// res.getEdges().add(new GraphEdge(tagId, nodeIdNum));
		// }
		// }

		// String label = null;
		// String content = node.getContent();
		// if (content!=null) {
		// if (content.length() > 40) {
		// label = content.substring(0, 40);
		// }
		// else {
		// label = content;
		// }
		// }
		// else {
		// label = nodeId;
		// }
	}
}
