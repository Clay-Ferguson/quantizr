package quanta.types;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.model.NodeInfo;
import quanta.mongo.model.SubNode;
import quanta.util.val.Val;

// IMPORTANT: See TypePluginMgr, and ServiceBase instantiation to initialize tyese Plugin types
@Component 
public abstract class TypeBase extends ServiceBase {
    @SuppressWarnings("unused")
    private static Logger log = LoggerFactory.getLogger(TypeBase.class);

    public TypeBase() {
        super();
    }

    public void postConstruct() {
        TypePluginMgr.addType(this);
    }

    /* Must match the actual type name of the nodes */
    public abstract String getName();

    public void convert(NodeInfo nodeInfo, SubNode node, SubNode ownerAccntNode,
            boolean getFollowers) {}

    public void preCreateNode(Val<SubNode> parentNode, Val<String> vcContent, boolean linkBookmark) {}

    // runs whenever this type 'node' has a child created under it
    public void childCreated(Val<SubNode> node, Val<SubNode> childNode) {}

    public void beforeSaveNode(SubNode node) {}

    // export type will be something like "PDF, ZIP, HTML, etc."
    public String formatExportText(String exportType, SubNode node) {
        return node.getContent();
    }
}
