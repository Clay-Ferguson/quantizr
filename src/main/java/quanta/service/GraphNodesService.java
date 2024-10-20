package quanta.service;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.GraphNode;
import quanta.model.client.SearchDefinition;
import quanta.mongo.model.SubNode;
import quanta.rest.request.GraphRequest;
import quanta.rest.response.GraphResponse;
import quanta.util.TL;
import quanta.util.XString;

@Component
public class GraphNodesService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(GraphNodesService.class);
    private int guid = 0;

    public GraphResponse cm_graphNodes(GraphRequest req) {
        SearchDefinition def = req.getSearchDefinition();
        HashMap<String, GraphNode> mapByPath = new HashMap<>();
        GraphResponse res = new GraphResponse();
        boolean searching = !StringUtils.isEmpty(def.getSearchText());

        SubNode node = svc_mongoRead.getNode(req.getNodeId());
        GraphNode gnode = new GraphNode(node.getIdStr(), getNodeName(node), node.getPath(), 0, false, node.getLinks());
        String rootPath = node.getPath();
        int rootLevel = StringUtils.countMatches(rootPath, "/");
        mapByPath.put(gnode.getPath(), gnode);

        try {
            Iterable<SubNode> results = null;
            // Run subgraph query to get all nodes if no search text provided
            if (StringUtils.isEmpty(def.getSearchText())) {
                results = svc_mongoRead.getSubGraph(node, null, 0, false, null);
            }
            // If search text provided run subgraph search.
            else {
                int limit = TL.getSC().isAdmin() ? Integer.MAX_VALUE : 1000;
                results = svc_mongoRead.searchSubGraph(node, null, def.getSearchText(), null, null, limit, 0,
                        def.isFuzzy(), def.isCaseSensitive(), null, def.isRecursive(), def.isRequirePriority(),
                        def.isRequireAttachment(), def.isRequireDate());
            }

            // Construct the GraphNode object for each result and add to mapByPath
            for (SubNode n : results) {
                try {
                    svc_auth.readAuth(node);
                    GraphNode gn = new GraphNode(n.getIdStr(), getNodeName(n), n.getPath(),
                            StringUtils.countMatches(n.getPath(), "/") - rootLevel, searching, n.getLinks());
                    mapByPath.put(gn.getPath(), gn);
                } catch (Exception e) {
                    // ignore
                }
            }

            // processNodes ensuring we have a coherent/complete/consistent tree (no orphans)
            processNodes(rootPath, rootLevel, mapByPath);
            res.setRootNode(gnode);
        } catch (Exception ex) {
            throw new RuntimeEx(ex);
        }
        return res;
    }

    private String getNodeName(SubNode node) {
        String content = node.getContent();
        if (content == null)
            return "";
        String name = null;
        int nlIdx = content.indexOf("\n");
        if (nlIdx != -1) {
            name = content.substring(0, nlIdx).trim();
            // remove leading hash marks which will be there if this is a markdown heading.
            while (name.startsWith("#")) {
                name = XString.stripIfStartsWith(name, "#");
            }
            name = name.trim();
        } else {
            name = content;
        }
        if (name.length() > 500) {
            name = name.substring(0, 500) + "...";
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
            String parentPath = XString.truncAfterLast(n.getPath(), "/");
            GraphNode parent = mapByPath.get(parentPath);
            if (parent != null) {
                parent.addChild(n);
            } else {
                log.debug("Top level node??:" + n);
            }
        }
    }

    public void ensureEnoughParents(String rootPath, int rootLevel, String path, HashMap<String, GraphNode> mapByPath) {
        if (path == null || path.length() < 3)
            return;
        String parentPath = XString.truncAfterLast(path, "/");
        if (parentPath.equals(rootPath))
            return;
        GraphNode parent = mapByPath.get(parentPath);
        if (parent == null) {
            /*
             * We only need guid on this name, to ensure D3 works, but the actual name on these is queries for
             * during mouseover because otherwise it could be a large number of queries to populate them here
             * now, when that's not needed.
             */
            parent = new GraphNode(parentPath, String.valueOf(guid++), parentPath,
                    StringUtils.countMatches(parentPath, "/") - rootLevel, false, null);
            mapByPath.put(parentPath, parent);
            // keep creating parents until we know we made it to common root.
            ensureEnoughParents(rootPath, rootLevel, parentPath, mapByPath);
        }
    }
}
