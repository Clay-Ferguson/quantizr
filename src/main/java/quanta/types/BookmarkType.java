package quanta.types;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import quanta.model.client.NodeType;
import quanta.mongo.MongoRead;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.CreateSubNodeRequest;
import quanta.service.NodeRenderService;
import quanta.util.Val;
import static quanta.util.Util.*;

@Component
public class BookmarkType extends TypeBase {

    @Autowired
	protected NodeRenderService render;

    @Autowired
	protected MongoRead read;

    @Override
    public String getName() {
        return NodeType.BOOKMARK.s();
    }

    public void createSubNode(MongoSession ms, Val<SubNode> node, CreateSubNodeRequest req, boolean linkBookmark) {
        // Note: if 'linkBookmark' is true then 'node' will be null here, and that's ok.
        SubNode nodeToBookmark = null;
        if (ok(node)) {
            nodeToBookmark = node.getVal();
            node.setVal(
                    read.getUserNodeByType(ms, ms.getUserName(), null, "### Bookmarks", NodeType.BOOKMARK_LIST.s(), null, null));
        }
        if (!linkBookmark && ok(nodeToBookmark)) {
            req.setContent(render.getFirstLineAbbreviation(nodeToBookmark.getContent(), 100));
        }
    }
}
