package quanta.types;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import quanta.model.client.NodeType;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.CreateSubNodeRequest;
import quanta.util.SubNodeUtil;
import quanta.util.Val;

@Lazy @Component
public class RoomType extends TypeBase {

    @Autowired
    @Lazy
	private SubNodeUtil snUtil;

    @Override
    public String getName() {
        return NodeType.ROOM.s();
    }

    public void createSubNode(MongoSession ms, Val<SubNode> node, CreateSubNodeRequest req, boolean linkBookmark) {
        snUtil.setNodePublicWritable(node.getVal());
    }
}
