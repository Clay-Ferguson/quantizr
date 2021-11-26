package org.subnode.types;

import org.springframework.stereotype.Component;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.CreateSubNodeRequest;
import org.subnode.util.Val;

@Component
public class RssFeedType extends TypeBase {

    @Override
    public String getName() {
        return NodeType.RSS_FEED.s();
    }

    public void createSubNode(MongoSession ms, Val<SubNode> node, CreateSubNodeRequest req, boolean linkBookmark) {
        SubNode holderNode = create.createNode(ms, node.getVal(), null, NodeType.NONE.s(), 0L, CreateNodeLocation.FIRST,
                req.getProperties(), null, false);
        holderNode.setContent("#### Edit this. Add your RSS title!");
        holderNode.touch();
        update.save(ms, holderNode);
        node.setVal(holderNode);
    }
}
