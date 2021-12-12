package quanta.types;

import org.springframework.stereotype.Component;
import quanta.model.client.NodeType;
import quanta.mongo.CreateNodeLocation;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.CreateSubNodeRequest;
import quanta.util.Val;

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
