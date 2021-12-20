package quanta.types;

import javax.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import quanta.model.NodeInfo;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.CreateSubNodeRequest;
import quanta.util.Val;

@Lazy
@Component
public abstract class TypeBase {
    private static final Logger log = LoggerFactory.getLogger(TypeBase.class);

    // For all @Lazy beans that need postConstruct to happen at app start time, it must be done manually.
    // @PostConstruct
    public void postContruct() {
        TypePluginMgr.addType(this);
    }

    /* Must match the actual type name of the nodes */
    public abstract String getName();

    public void convert(MongoSession ms, NodeInfo nodeInfo, SubNode node, boolean getFollowers) {}

    public void createSubNode(MongoSession ms, Val<SubNode> node, CreateSubNodeRequest req, boolean linkBookmark) {}
}
