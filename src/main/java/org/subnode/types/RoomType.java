package org.subnode.types;

import org.springframework.stereotype.Component;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.CreateSubNodeRequest;
import org.subnode.util.Val;

@Component
public class RoomType extends TypeBase {

    @Override
    public String getName() {
        return NodeType.ROOM.s();
    }

    public void createSubNode(MongoSession ms, Val<SubNode> node, CreateSubNodeRequest req, boolean linkBookmark) {
        snUtil.setNodePublicWritable(node.getVal());
    }
}
