package quanta.mongo;

import java.util.Calendar;
import java.util.Date;
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
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.exception.ForbiddenException;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.model.SubNode;
import quanta.util.Const;
import quanta.util.ExUtil;
import quanta.util.ThreadLocals;
import quanta.util.XString;

/**
 * Performs update (as in CRUD) operations for MongoDB
 */
@Component
public class MongoUpdate extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(MongoUpdate.class);

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

        beforeSave(node);

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
        saveSession(ms, false);
    }

    public void saveSession(MongoSession ms, boolean asAdmin) {
        if (ms == null) {
            log.warn("saveSession called with null session");
            return;
        }

        if (!ThreadLocals.hasDirtyNodes()) {
            // log.warn("saveSession called with no dirty nodes");
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

                    // check that we are allowed to write all, before we start writing any
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
                        save(ms, node, false);
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
        Update upd = new Update();
        upd.set(SubNode.HAS_CHILDREN, null);
        opsw.findAndModify(query, upd);
    }

    // returns a new BulkOps if one not yet existing
    public BulkOperations bulkOpSetPropVal(MongoSession ms, BulkOperations bops, ObjectId id, String prop, Object val,
            boolean addSecurity) {
        if (bops == null) {
            bops = opsw.bulkOps(BulkMode.UNORDERED);
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
            bops = opsw.bulkOps(BulkMode.UNORDERED);
        }
        Criteria crit = new Criteria("id").is(id);
        Query query = new Query().addCriteria(crit);
        Update update = new Update().unset(prop);
        bops.updateOne(query, update);
        return bops;
    }

    // Originally from MongoEventListener onBeforeSave
    public void beforeSave(SubNode node) {
        ObjectId id = node.getId();
        boolean isNew = false;

        if (id == null) {
            id = new ObjectId();
            node.setId(id);
            isNew = true;
        }

        // Extra protection to be sure accounts and repo root can't have any sharing
        if (NodeType.ACCOUNT.s().equals(node.getType()) || NodeType.REPO_ROOT.s().equals(node.getType())) {
            node.setAc(null);
        }

        if (Const.HOME_NODE_NAME.equalsIgnoreCase(node.getName())) {
            node.set(NodeProp.UNPUBLISHED, true);
        }
        if (node.getOrdinal() == null) {
            node.setOrdinal(0L);
        }
        // if no owner is assigned
        if (node.getOwner() == null) {
            /*
             * if we are saving the root node, we make it be the owner of itself. This is also the admin owner,
             * and we only allow this to run during initialiation when the server may be creating the database,
             * and is not yet processing user requests
             */
            if (node.getPath().equals(NodePath.ROOT_PATH) && !MongoRepository.fullInit) {
                ThreadLocals.requireAdminThread();
                node.setOwner(id);
            } else {
                if (auth.getAdminSession() != null) {
                    ObjectId ownerId = auth.getAdminSession().getUserNodeId();
                    node.setOwner(ownerId);
                    log.debug("Assigning admin as owner of node that had no owner (on save): " + id);
                }
            }
        }
        Date now = null;
        // If no create/mod time has been set, then set it
        if (node.getCreateTime() == null) {
            if (now == null) {
                now = Calendar.getInstance().getTime();
            }
            node.setCreateTime(now);
        }

        if (node.getModifyTime() == null) {
            if (now == null) {
                now = Calendar.getInstance().getTime();
            }
            node.setModifyTime(now);
        }

        // New nodes can be given a path where they will allow the ID to play the role of the leaf 'name'
        // part of the path
        if (node.getPath().endsWith("/?")) {
            String path = mongoUtil.findAvailablePath(XString.removeLastChar(node.getPath()));
            node.setPath(path);
            isNew = true;
        }
        // make sure root node can never have any sharing.
        if (node.getPath().equals(NodePath.ROOT_PATH) && node.getAc() != null) {
            node.setAc(null);
        }

        verifyParentExists(node, isNew);
        saveAuthByThread(node, isNew);

        // Node name not allowed to contain : or ~
        String nodeName = node.getName();
        if (nodeName != null) {
            nodeName = nodeName.replace(":", "-");
            nodeName = nodeName.replace("~", "-");
            nodeName = nodeName.replace("/", "-");
            // Warning: this is not a redundant null check. Some code in this block CAN set
            // to null.
            if (nodeName != null) {
                node.setName(nodeName);
            }
        }
        snUtil.removeDefaultProps(node);

        if (node.getAc() != null) {
            /*
             * we need to ensure that we never save an empty Acl, but null instead, because some parts of the
             * code assume that if the AC is non-null then there ARE some shares on the node.
             * 
             * This 'fix' only started being necessary I think once I added the safeGetAc, and that check ends
             * up causing the AC to contain an empty object sometimes
             */
            if (node.getAc().size() == 0) {
                node.setAc(null);
            } else {
                // Remove any share to self because that never makes sense
                if (node.getOwner() != null) {
                    if (node.getAc().remove(node.getOwner().toHexString()) != null) {
                    }
                }
            }
        }
        attach.fixAllAttachmentMimes(node);

        // Since we're saving this node already make sure none of our setters above left it flagged
        // as dirty or it might unnecessarily get saved twice.
        ThreadLocals.clean(node);

        // keep track of root node
        if (NodePath.ROOT_PATH.equals(node.getPath())) {
            read.setDbRoot(node);
        }
    }

    private void verifyParentExists(SubNode node, boolean isNew) {
        if (!node.getPath().startsWith(NodePath.PENDING_PATH_S) && ThreadLocals.getParentCheckEnabled()
                && (isNew || node.verifyParentPath)) {
            try {
                read.checkParentExists(null, node.getPath());
            } catch (Exception e) {
                node.setId(null);
                throw new RuntimeException("Parent path did not exist: " + node.getPath());
            }
        }
    }

    /* To save a node you must own the node and have WRITE access to it's parent */
    public void saveAuthByThread(SubNode node, boolean isNew) {
        // during server init no auth is required.
        if (!MongoRepository.fullInit) {
            return;
        }
        if (node.adminUpdate)
            return;

        MongoSession ms = ThreadLocals.getMongoSession();
        if (ms != null) {
            if (ms.isAdmin())
                return;
            // Must have write privileges to this node.
            auth.ownerAuth(node);
            // only if this is creating a new node do we need to check that the parent will allow it
            if (isNew && !node.getPath().startsWith(NodePath.PENDING_PATH_S)) {
                SubNode parent = read.getParent(ms, node);
                if (parent == null) {
                    log.debug("This SAVE should get rejected (its parent is missing): " + XString.prettyPrint(node));

                    /*
                     * Make MongoDB fail to save this by sabatoging the ID here. It's the only way to abort the save.
                     * Supposedly throwing the Exception which we do below, is supposed to abort saves but it's not
                     * working where as nullifying the ID does indeed abort the save.
                     */
                    node.setId(null);
                    throw new RuntimeException("unable to get node parent: " + node.getParentPath());
                }

                auth.writeAuth(ms, parent);
                if (acl.isAdminOwned(parent) && !ms.isAdmin()) {
                    // ditto note above about aborting the save
                    node.setId(null);
                    throw new ForbiddenException();
                }
            }
        }
    }
}
