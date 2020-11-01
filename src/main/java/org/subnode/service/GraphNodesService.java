package org.subnode.service;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;

import org.apache.commons.lang3.StringUtils;
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
		GraphNode gnode = new GraphNode(node.getId().toHexString(), getNodeName(node), node.getPath());
		String rootPath = node.getPath();

		mapByPath.put(gnode.getPath(), gnode);
		// log.debug("Root Node Path: " + node.getPath());

		try {
			Iterable<SubNode> results = null;

			if (StringUtils.isEmpty(req.getSearchText())) {
				results = read.getSubGraph(session, node);
			} else {
				results = read.searchSubGraph(session, node, "content", req.getSearchText(), null, 1000, false, false);
			}

			for (SubNode n : results) {
				// log.debug("Node Path: " + n.getPath());
				GraphNode gn = new GraphNode(n.getId().toHexString(), getNodeName(n), n.getPath());
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

	private String getNodeName(SubNode node) {
		String content = node.getContent();
		if (content == null)
			return "";
		String name = null;

		int newLineIdx = content.indexOf("\n");
		if (newLineIdx != -1) {
			name = content.substring(0, newLineIdx).trim();

			// remove leading hash marks which will be there if this is a markdown heading.
			while (name.startsWith("#")) {
				name = XString.stripIfStartsWith(name, "#");
			}
			name = name.trim();
		} else {
			name = content;
		}
		if (name.length() > 100) {
			name = name.substring(0, 100) + "...";
		}
		return name;
	}

	private void processNodes(String rootPath, HashMap<String, GraphNode> mapByPath) {

		// get a collection to hold keys so we don't get concurrent modification
		// exception when updating the map.
		List<String> keys = new LinkedList<String>();
		for (String path : mapByPath.keySet()) {
			keys.add(path);
		}

		/*
		 * First scan to create any parents that don't exist, putting them in newNodes
		 */
		for (String path : keys) {
			ensureEnoughParents(rootPath, path, mapByPath);
		}

		// now add all nodes to the child list of their parents.
		for (String path : mapByPath.keySet()) {
			if (path.equals(rootPath))
				continue;

			GraphNode n = mapByPath.get(path);
			String parentPath = XString.truncateAfterLast(n.getPath(), "/");
			// log.debug("Looking for Parent (b): " + parentPath);
			GraphNode parent = mapByPath.get(parentPath);
			if (parent != null) {
				parent.addChild(n);
				// log.debug("Parent Name "+parent.getName()+" now has
				// childCount="+parent.getChildren().size());
			} else {
				log.debug("Top level node??:" + n);
			}
		}
	}

	public void ensureEnoughParents(String rootPath, String path, HashMap<String, GraphNode> mapByPath) {

		if (path == null || path.length() < 3)
			return;

		String parentPath = XString.truncateAfterLast(path, "/");
		if (parentPath.equals(rootPath))
			return;

		GraphNode parent = mapByPath.get(parentPath);

		if (parent == null) {
			// todo-0: browser does a live query on nodes where id start with slash meaning it was one of these 'scaffolding' nodes
			// not part of search results so need to avoid sending back any 'name' property here. not needed. it's queried live.
			// but be careful right now a null name here DOES break the code.
			parent = new GraphNode(parentPath, parentPath, parentPath);
			mapByPath.put(parentPath, parent);

			// keep creating parents until we know we made it to common root.
			ensureEnoughParents(rootPath, parentPath, mapByPath);
		}
	}
}
