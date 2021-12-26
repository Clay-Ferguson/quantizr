package quanta.types;

import javax.annotation.PostConstruct;
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

    @PostConstruct
	public void postConstruct() {
		roomType = this;
	}

    public void createSubNode(MongoSession ms, Val<SubNode> node, CreateSubNodeRequest req, boolean linkBookmark) {
        snUtil.setNodePublicWritable(node.getVal());
    }
}
