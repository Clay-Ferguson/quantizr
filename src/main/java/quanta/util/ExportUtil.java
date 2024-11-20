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
            String nodeName = matcher.group(1);
            log.debug("FIGURE: " + nodeName);
            TreeNode tn = treeItemsByNodeName.get(nodeName);
            if (tn == null) {
                // needs to be a reported error that makes it's way to the screen.
                log.warn("Figure node not found: " + nodeName);
                continue;
            }
            content = content.replace("{{figure:" + nodeName + "}}", "Fig. " + tn.figNumStart);
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
