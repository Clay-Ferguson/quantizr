package org.subnode.types;

import javax.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.subnode.model.NodeInfo;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.CreateSubNodeRequest;
import org.subnode.util.ValContainer;

@Component
public abstract class TypeBase {
    private static final Logger log = LoggerFactory.getLogger(TypeBase.class);

    @PostConstruct
    public void postContruct() {
        TypePluginMgr.addType(this);
    }

    /* Must match the actual type name of the nodes */
    public abstract String getName();

    public void convert(MongoSession session, NodeInfo nodeInfo, SubNode node, boolean getFollowers) {}

    public void createSubNode(MongoSession session, ValContainer<SubNode> node, CreateSubNodeRequest req, boolean linkBookmark) {}
}
