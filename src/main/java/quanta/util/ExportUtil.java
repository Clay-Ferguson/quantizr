package quanta.util;

import java.util.HashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import quanta.model.TreeNode;

public class ExportUtil {
    private static Logger log = LoggerFactory.getLogger(ExportUtil.class);

    public static String injectFigureLinks(HashMap<String, TreeNode> treeItemsByNodeName, String content) {
        // using regex we find the pattern {{figure:[node_name]}} and iterate over all of them where the
        // [node_name]
        // is a variable that we need to have during iteration
        String regex = "\\{\\{figure:([^\\}]+)\\}\\}";
        Pattern pattern = Pattern.compile(regex);
        Matcher matcher = pattern.matcher(content);
        while (matcher.find()) {
            String groupMatch = matcher.group(1);
            String nodeName = groupMatch;

            // if nodeName contains a comma, we split off what is to the right of the comma into a string called
            // offset, and then set nodeName to be the left part of the comma.
            String offset = "";
            int intOffset = 0;
            if (nodeName.contains(",")) {
                String[] parts = nodeName.split(",");
                nodeName = parts[0];
                offset = parts[1];
            }
            // if offset is not empty, we add it to the figNumStart of the node.
            if (!offset.isEmpty()) {
                intOffset = Integer.parseInt(offset.trim());
                if (intOffset < 0) {
                    intOffset = 0;
                } else if (intOffset > 0) {
                    intOffset--;
                }
            }

            TreeNode tn = treeItemsByNodeName.get(nodeName);
            if (tn == null) {
                // needs to be a reported error that makes it's way to the screen.
                log.warn("Figure node not found: " + nodeName);
                continue;
            }
            content = content.replace("{{figure:" + groupMatch + "}}",
                    "Fig. " + String.valueOf(tn.figNumStart + intOffset));
        }
        return content;
    }

    // This method is used to pre-process the tree and set the figNumStart for each node
    // and returns the current global figNumStart.
    public static int prePocessTree(HashMap<String, TreeNode> treeItemsByNodeName, int figNumStart, TreeNode root) {
        if (root.node.getAttachments() != null && root.node.getAttachments().size() > 0) {
            root.figNumStart = figNumStart;
            figNumStart += root.node.getAttachments().size();
        }

        String nodeName = root.node.getName();
        if (nodeName != null) {
            if (treeItemsByNodeName.containsKey(nodeName)) {
                log.warn("Duplicate node name: " + nodeName + " on nodeId " + root.node.getIdStr());
            } else {
                treeItemsByNodeName.put(nodeName, root);
            }
        }

        if (root.children == null)
            return figNumStart;

        for (TreeNode c : root.children) {
            figNumStart = prePocessTree(treeItemsByNodeName, figNumStart, c);
        }
        return figNumStart;
    }
}
