package quanta.types;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;
import quanta.model.client.NodeType;
import quanta.mongo.model.SubNode;
import quanta.util.TL;
import quanta.util.val.Val;

// IMPORTANT: See TypePluginMgr, and ServiceBase instantiation to initialize tyese Plugin types
@Component 
public class BookmarkType extends TypeBase {

    @Override
    public String getName() {
        return NodeType.BOOKMARK.s();
    }

    public void preCreateNode(Val<SubNode> parentNode, Val<String> vcContent, boolean linkBookmark) {
        // Note: if 'linkBookmark' is true then 'node' will be null here, and that's ok.
        SubNode nodeToBookmark = null;
        if (parentNode != null) {
            nodeToBookmark = parentNode.getVal();
            parentNode.setVal(svc_mongoRead.getUserNodeByType(TL.getSC().getUserName(), null, "### Bookmarks",
                    NodeType.BOOKMARK_LIST.s(), null, true));
        }
        if (vcContent != null && StringUtils.isEmpty(vcContent.getVal()) && !linkBookmark && nodeToBookmark != null) {
            vcContent.setVal(svc_render.getFirstLineAbbreviation(nodeToBookmark.getContent(), 50));
        }
    }
}
