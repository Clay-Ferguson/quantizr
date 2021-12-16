package quanta.types;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import quanta.model.client.NodeType;
import quanta.mongo.CreateNodeLocation;
import quanta.mongo.MongoCreate;
import quanta.mongo.MongoSession;
import quanta.mongo.MongoUpdate;
import quanta.mongo.model.SubNode;
import quanta.request.CreateSubNodeRequest;
import quanta.util.Val;

@Lazy @Component
public class RssFeedType extends TypeBase {

    @Autowired
    @Lazy
	protected MongoUpdate update;

    @Autowired
    @Lazy
	protected MongoCreate create;

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
