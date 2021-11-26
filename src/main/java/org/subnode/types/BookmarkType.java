package org.subnode.types;

import org.springframework.stereotype.Component;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.CreateSubNodeRequest;
import org.subnode.util.Val;

@Component
public class BookmarkType extends TypeBase {

    @Override
    public String getName() {
        return NodeType.BOOKMARK.s();
    }

    public void createSubNode(MongoSession ms, Val<SubNode> node, CreateSubNodeRequest req, boolean linkBookmark) {
        // Note: if 'linkBookmark' is true then 'node' will be null here, and that's ok.
        SubNode nodeToBookmark = null;
        if (node != null) {
            nodeToBookmark = node.getVal();
            node.setVal(read.getUserNodeByType(ms, ms.getUserName(), null, "### Bookmarks", NodeType.BOOKMARK_LIST.s(),
                    null, null));
        }
        if (!linkBookmark && nodeToBookmark != null) {
            req.setContent(render.getFirstLineAbbreviation(nodeToBookmark.getContent(), 100));
        }
    }
}
