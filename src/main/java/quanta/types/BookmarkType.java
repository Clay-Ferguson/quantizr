package quanta.types;

import static quanta.util.Util.ok;
import javax.annotation.PostConstruct;
import org.springframework.stereotype.Component;
import quanta.model.client.NodeType;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.CreateSubNodeRequest;
import quanta.util.Val;


@Component
public class BookmarkType extends TypeBase {

    @Override
    public String getName() {
        return NodeType.BOOKMARK.s();
    }

    @PostConstruct
	public void postConstruct() {
		bookmarkType = this;
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
