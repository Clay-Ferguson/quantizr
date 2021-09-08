package org.subnode.types;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.CreateSubNodeRequest;
import org.subnode.service.NodeRenderService;
import org.subnode.util.ValContainer;

@Component
public class BookmarkType extends TypeBase {

    @Autowired
    private MongoRead read;

    @Autowired
    private NodeRenderService render;

    @Override
    public String getName() {
        return NodeType.BOOKMARK.s();
    }

    public void createSubNode(MongoSession session, ValContainer<SubNode> node, CreateSubNodeRequest req, boolean linkBookmark) {
        // Note: if 'linkBookmark' is true then 'node' will be null here, and that's ok.
        SubNode nodeToBookmark = null;
        if (node != null) {
            nodeToBookmark = node.getVal();
            node.setVal(read.getUserNodeByType(session, session.getUserName(), null, "### Bookmarks", NodeType.BOOKMARK_LIST.s(),
                    null, null));
        }
        if (!linkBookmark && nodeToBookmark != null) {
            req.setContent(render.getFirstLineAbbreviation(nodeToBookmark.getContent(), 100));
        }
    }
}
