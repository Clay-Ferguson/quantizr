package quanta.mongo;

import java.util.LinkedList;
import java.util.List;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.BulkOperations.BulkMode;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.mongo.model.SubNode;
import quanta.util.ExUtil;
import quanta.util.ThreadLocals;
import quanta.util.XString;

/**
 * Performs update (as in CRUD) operations for MongoDB
 */
@Component
public class MongoUpdate extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(MongoUpdate.class);

    public void saveObj(Object obj) {
        opsw.save(obj);
    }

    public void saveIfDirty(MongoSession ms, SubNode node) {
        if (node == null || !ThreadLocals.hasDirtyNode(node.getId()))
            return;
        save(ms, node, true);
    }

    public void save(MongoSession ms, SubNode node) {
        save(ms, node, true);
    }

    public void updateParentHasChildren(SubNode node) {
        if (node == null)
            return;
        arun.run(as -> {
            SubNode parent = read.findNodeByPath(as, node.getParentPath(), false);
            if (parent != null) {
                parent.setHasChildren(true);
            }
            return null;
        });
    }

    public void save(MongoSession ms, SubNode node, boolean allowAuth) {
        if (allowAuth) {
            auth.ownerAuth(ms, node);
        }
        // calling this may result in an update of this node's children property, and we want to call
        // it here rather than later so if this modified the node it doesn't trigger an additional write.
        read.hasChildren(ms, node);

        // if not doing allowAuth, we need to be sure the thread has admin session
        // because the MongoEventListener looks in threadlocals for auth
        if (!allowAuth) {
            arun.run(as -> {
                opsw.save(node);
                return null;
            });
        }
        // otherwise leave same/current threadlocals as is and MongoEventListener will auth based
        // on this
        else {
            opsw.save(node);
        }
        ThreadLocals.clean(node);
    }

    public void saveSession(MongoSession ms) {
        update.saveSession(ms, false);
    }

    public void saveSession(MongoSession ms, boolean asAdmin) {
        if (ms == null) {
            log.warn("saveSession called with null session");
            return;
        }

        if (!ThreadLocals.hasDirtyNodes()) {
            log.warn("saveSession called with no dirty nodes");
            return;
        }

        synchronized (ThreadLocals.getDirtyNodes()) {
            try {
                synchronized (ms) {
                    ThreadLocals.getDirtyNodes().forEach((key, value) -> {
                        if (!key.toHexString().equals(value.getIdStr())) {
                            throw new RuntimeException("Node originally cached as ID " + key.toHexString()
                                    + " now has key" + value.getIdStr());
                        }
                    });

                    /*
                     * We use 'nodes' list to avoid a concurrent modification exception, because calling 'save()' on a
                     * node will have the side effect of removing it from dirtyNodes, and that can't happen during the
                     * loop below because we're iterating over dirtyNodes.
                     */
                    List<SubNode> nodes = new LinkedList<>();

                    /*
                     * check that we are allowed to write all, before we start writing any
                     */
                    for (SubNode node : ThreadLocals.getDirtyNodes().values()) {
                        try {
                            auth.ownerAuth(ms, node);
                        } catch (Exception e) {
                            log.warn("Dirty node save attempt failed: " + XString.prettyPrint(node)
                                    + "\nmongoSession has user: " + ms.getUserName() + " and ThreadLocal session is: "
                                    + ThreadLocals.getSC().getUserName());
                        }
                        nodes.add(node);
                    }

                    for (SubNode node : nodes) {
                        update.save(ms, node, false);
                    }
                }
                log.debug("sync block for ms - exiting");
            } catch (Exception e) {
                // don't rethrow any exceptions from in here.
                ExUtil.error(log, "exception in call processor", e);
            }
        }
    }

    public void resetChildrenState() {
        Query query = new Query();
        Update update = new Update();
        update.set(SubNode.HAS_CHILDREN, null);
        opsw.findAndModify(query, update, SubNode.class);
    }

    // returns a new BulkOps if one not yet existing
    public BulkOperations bulkOpSetPropVal(MongoSession ms, BulkOperations bops, ObjectId id, String prop, Object val,
            boolean addSecurity) {
        if (bops == null) {
            bops = opsw.bulkOps(BulkMode.UNORDERED, SubNode.class);
        }
        Criteria crit = new Criteria("id").is(id);
        if (addSecurity) {
            crit = auth.addWriteSecurity(ms, crit);
        }
        Query query = new Query().addCriteria(crit);
        Update update = new Update().set(prop, val);
        bops.updateOne(query, update);
        return bops;
    }

    public BulkOperations bulkOpDelProp(MongoSession ms, BulkOperations bops, ObjectId id, String prop) {
        if (bops == null) {
            bops = opsw.bulkOps(BulkMode.UNORDERED, SubNode.class);
        }
        Criteria crit = new Criteria("id").is(id);
        Query query = new Query().addCriteria(crit);
        Update update = new Update().unset(prop);
        bops.updateOne(query, update);
        return bops;
    }
}
