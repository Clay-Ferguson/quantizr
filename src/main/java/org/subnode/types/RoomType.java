package org.subnode.types;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.CreateSubNodeRequest;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.ValContainer;

@Component
public class RoomType extends TypeBase {

    @Autowired
    private SubNodeUtil snUtil;

    @Override
    public String getName() {
        return NodeType.ROOM.s();
    }

    public void createSubNode(MongoSession ms, ValContainer<SubNode> node, CreateSubNodeRequest req, boolean linkBookmark) {
        snUtil.setNodePublicWritable(node.getVal());
    }
}
