package quanta.mongo;

import org.apache.commons.lang3.StringUtils;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.mapping.event.AbstractMongoEventListener;
import org.springframework.data.mongodb.core.mapping.event.AfterConvertEvent;
import org.springframework.data.mongodb.core.mapping.event.AfterLoadEvent;
import org.springframework.stereotype.Component;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.model.SubNode;
import quanta.util.Const;
import quanta.util.ThreadLocals;

@Component
public class MongoEventListener extends AbstractMongoEventListener<SubNode> {
    private static Logger log = LoggerFactory.getLogger(MongoEventListener.class);

    @Autowired
    private MongoAuth auth;

    @Override
    public void onAfterLoad(AfterLoadEvent<SubNode> event) {
        Document dbObj = event.getDocument();
        ObjectId id = dbObj.getObjectId(SubNode.ID);
        if (ThreadLocals.hasDirtyNode(dbObj.getObjectId(SubNode.ID))) {
            log.warn("DIRTY READ (onAfterLoad): " + id.toHexString());
        }
    }

    @Override
    public void onAfterConvert(AfterConvertEvent<SubNode> event) {
        SubNode node = event.getSource();
        if (node.getOwner() == null) {
            if (auth.getAdminSession() != null) {
                node.setOwner(auth.getAdminSession().getUserNodeId());
                log.debug("Assigning admin as owner of node that had no owner (on load): " + node.getIdStr());
            }
        }

        // Extra protection to be sure accounts and repo root can't have any sharing
        if (NodeType.ACCOUNT.s().equals(node.getType()) || NodeType.REPO_ROOT.s().equals(node.getType())) {
            node.setAc(null);
        }
        // home nodes are always unpublished
        if (Const.HOME_NODE_NAME.equalsIgnoreCase(node.getName())) {
            node.set(NodeProp.UNPUBLISHED, true);
        }

        node.fixAttachments();
        node.verifyParentPath = StringUtils.isEmpty(node.getPath());
    }
}
