package quanta.mongo;

import org.apache.commons.lang3.StringUtils;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.mapping.event.AbstractMongoEventListener;
import org.springframework.data.mongodb.core.mapping.event.AfterConvertEvent;
import org.springframework.data.mongodb.core.mapping.event.AfterLoadEvent;
import org.springframework.data.mongodb.core.mapping.event.BeforeDeleteEvent;
import org.springframework.stereotype.Component;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.model.SubNode;
import quanta.util.Const;
import quanta.util.EventPublisher;
import quanta.util.ThreadLocals;

// NOTE: Slowly over time I'm moving this functionality over to SubNodUtil.java where we call these
// methods directly. I don't like this listener patter, because I think ultimately it makes things
// more complex, not less complex.
// todo-0: finish removing this class.

/**
 * Listener that MongoDB driver hooks into so we can inject processing into various phases of the
 * persistence (reads/writes) of the MongoDB objects.
 *
 * WARNING: This will NOT get called for bulk operations so all we should do in here is things
 * related to when a user is manipulating objects one at a time.
 * 
 * Listener Lifecycle Events:
 *
 * onBeforeConvert: Called in MongoTemplate insert, insertList, and save operations before the
 * object is converted to a Document by a MongoConverter.
 *
 * onBeforeSave: Called in MongoTemplate insert, insertList, and save operations before inserting or
 * saving the Document in the database.
 *
 * onAfterSave: Called in MongoTemplate insert, insertList, and save operations after inserting or
 * saving the Document in the database.
 *
 * onAfterLoad: Called in MongoTemplate find, findAndRemove, findOne, and getCollection methods
 * after the Document has been retrieved from the database.
 *
 * onAfterConvert: Called in MongoTemplate find, findAndRemove, findOne, and getCollection methods
 * after the Document has been retrieved from the database was converted to a POJO.
 */
@Component
public class MongoEventListener extends AbstractMongoEventListener<SubNode> {
    private static Logger log = LoggerFactory.getLogger(MongoEventListener.class);

    @Autowired
    protected MongoTemplate ops;

    @Autowired
    private MongoAuth auth;

    @Autowired
    private EventPublisher publisher;

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

    @Override
    public void onBeforeDelete(BeforeDeleteEvent<SubNode> event) {
        if (!MongoRepository.fullInit)
            return;
        Document doc = event.getDocument();
        if (doc != null) {
            Object id = doc.get("_id");
            if (id instanceof ObjectId) {
                SubNode node = ops.findById(id, SubNode.class);
                if (node != null) {
                    log.trace("MDB del: " + node.getPath());
                    auth.ownerAuth(node);
                    ThreadLocals.clean(node);
                }
                publisher.getPublisher().publishEvent(new MongoDeleteEvent(id));
            }
        }
    }
}
