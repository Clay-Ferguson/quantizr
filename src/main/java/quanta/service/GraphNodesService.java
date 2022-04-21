package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.model.GraphNode;
import quanta.model.client.PrivilegeType;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.GraphRequest;
import quanta.response.GraphResponse;
import quanta.util.ExUtil;
import quanta.util.ThreadLocals;
import quanta.util.XString;

@Component
public class GraphNodesService extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(GraphNodesService.class);

	static int guid = 0;

	public GraphResponse graphNodes(MongoSession ms, GraphRequest req) {
		HashMap<String, GraphNode> mapByPath = new HashMap<>();
		GraphResponse res = new GraphResponse();
		ms = ThreadLocals.ensure(ms);

		boolean searching = !StringUtils.isEmpty(req.getSearchText());
		SubNode node = read.getNode(ms, req.getNodeId(), true);
		GraphNode gnode = new GraphNode(node.getIdStr(), getNodeName(node), node.getPath(), 0, false);
		String rootPath = node.getPath();
		int rootLevel = StringUtils.countMatches(rootPath, "/");

		mapByPath.put(gnode.getPath(), gnode);
		// log.debug("Root Node Path: " + node.getPath());

		try {
			Iterable<SubNode> results = null;

			// Run subgraph query to get all nodes if no search text provided
			if (StringUtils.isEmpty(req.getSearchText())) {
				results = read.getSubGraph(ms, node, null, 0, true, false);
			}
			// If search text provided run subgraph search.
			else {
				int limit = ThreadLocals.getSC().isAdmin() ? Integer.MAX_VALUE : 1000;
				results = read.searchSubGraph(ms, node, "content", req.getSearchText(), null, null, limit, 0, true, false, null,
						true, false);
			}

			// Construct the GraphNode object for each result and add to mapByPath
			for (SubNode n : results) {
				try {
					auth.auth(ms, node, PrivilegeType.READ);
					GraphNode gn = new GraphNode(n.getIdStr(), getNodeName(n), n.getPath(),
							StringUtils.countMatches(n.getPath(), "/") - rootLevel, searching);
					mapByPath.put(gn.getPath(), gn);
				} catch (Exception e) {
				}
			}

			// processNodes ensuring we have a coherent/complete/consistent tree (no orphans)
			processNodes(rootPath, rootLevel, mapByPath);
			res.setRootNode(gnode);
		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		}

		res.setSuccess(true);
		return res;
	}

	private String getNodeName(SubNode node) {
		String content = node.getContent();
		if (no(content))
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

	private void processNodes(String rootPath, int rootLevel, HashMap<String, GraphNode> mapByPath) {
		// get a collection to hold keys so we don't get concurrent modification
		// exception when updating the map.
		List<String> keys = new LinkedList<>();
		for (String path : mapByPath.keySet()) {
			keys.add(path);
		}

		/*
		 * First scan to create any parents that don't exist, putting them in mapByPath. Since the query to
		 * get nodes wasn't a pure recursive method we can have nodes in 'mapByPath' which don't have their
		 * parent in mapByPath, so we want to pull all those parents into 'mapByPath' too, to be sure we
		 * have a an actual proper directed graph to send back to client (no orphans in it, not connected to
		 * root)
		 */
		for (String path : keys) {
			ensureEnoughParents(rootPath, rootLevel, path, mapByPath);
		}

		// now add all nodes to the child list of their parents.
		for (String path : mapByPath.keySet()) {
			if (path.equals(rootPath))
				continue;

			GraphNode n = mapByPath.get(path);
			String parentPath = XString.truncateAfterLast(n.getPath(), "/");
			// log.debug("Looking for Parent (b): " + parentPath);
			GraphNode parent = mapByPath.get(parentPath);
			if (ok(parent)) {
				parent.addChild(n);
				// log.debug("Parent Name "+parent.getName()+" now has
				// childCount="+parent.getChildren().size());
			} else {
				log.debug("Top level node??:" + n);
			}
		}
	}

	public void ensureEnoughParents(String rootPath, int rootLevel, String path, HashMap<String, GraphNode> mapByPath) {
		if (no(path) || path.length() < 3)
			return;

		String parentPath = XString.truncateAfterLast(path, "/");
		if (parentPath.equals(rootPath))
			return;

		GraphNode parent = mapByPath.get(parentPath);

		if (no(parent)) {
			// We only need guid on this name, to ensure D3 works, but the actual name on these
			// is queries for during mouseover because otherwise it could be a large number
			// of queries to populate them here now, when that's not needed.
			parent = new GraphNode(parentPath, String.valueOf(guid++), parentPath,
					StringUtils.countMatches(parentPath, "/") - rootLevel, false);
			mapByPath.put(parentPath, parent);

			// keep creating parents until we know we made it to common root.
			ensureEnoughParents(rootPath, rootLevel, parentPath, mapByPath);
		}
	}
}
