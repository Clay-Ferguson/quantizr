package quanta.types;

import org.springframework.stereotype.Component;
import quanta.model.client.NodeType;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.CreateSubNodeRequest;
import quanta.util.Val;

@Component
public class RoomType extends TypeBase {

    @Override
    public String getName() {
        return NodeType.ROOM.s();
    }

    public void createSubNode(MongoSession ms, Val<SubNode> node, CreateSubNodeRequest req, boolean linkBookmark) {
        snUtil.setNodePublicAppendable(node.getVal());
    }
}
