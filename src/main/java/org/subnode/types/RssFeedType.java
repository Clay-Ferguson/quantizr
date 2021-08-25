package org.subnode.types;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoCreate;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.CreateSubNodeRequest;
import org.subnode.util.ValContainer;

@Component
public class RssFeedType extends TypeBase {

    @Autowired
    private MongoCreate create;

    @Autowired
    private MongoUpdate update;

    @Override
    public String getName() {
        return "sn:rssFeed";
    }

    public void createSubNode(MongoSession session, ValContainer<SubNode> node, CreateSubNodeRequest req, boolean linkBookmark) {
        if (!NodeType.RSS_FEED.s().equals(req.getTypeName()))
            return;

        SubNode holderNode = create.createNode(session, node.getVal(), null, NodeType.NONE.s(), 0L, CreateNodeLocation.FIRST,
                req.getProperties(), null, false);
        holderNode.setContent("#### Edit this. Add your RSS title!");
        holderNode.touch();
        update.save(session, holderNode);
        node.setVal(holderNode);
    }
}
