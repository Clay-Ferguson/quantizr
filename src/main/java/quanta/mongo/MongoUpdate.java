package quanta.mongo;

import java.util.Calendar;
import java.util.Collection;
import java.util.Date;
import java.util.HashSet;
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
import quanta.exception.base.RuntimeEx;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.model.SubNode;
import quanta.util.Const;
import quanta.util.ExUtil;
import quanta.util.TL;
import quanta.util.XString;
import quanta.util.val.IntVal;
import quanta.util.val.Val;

/**
 * Performs update (as in CRUD) operations for MongoDB
 */
@Component
public class MongoUpdate extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(MongoUpdate.class);

    public void saveIfDirty(SubNode node) {
        if (node == null || !TL.hasDirtyNode(node.getId()))
            return;
        save(node);
    }

    public void updateParentHasChildren(SubNode node) {
        if (node == null)
            return;
        svc_arun.run(() -> {
            SubNode parent = svc_mongoRead.findNodeByPathAP(node.getParentPath());
            if (parent != null) {
                parent.setHasChildren(true);
            }
            return null;
        });
    }

    public void save(SubNode node) {
        // if the thread doesn't have admin privs, and the current user is not the owner of this node throw
        // an exception
        if (!TL.hasAdminPrivileges()
                && (node.getOwner() == null || !node.getOwner().equals(TL.getSC().getUserNodeObjId()))) {
            throw new ForbiddenException();
        }
        /*
         * calling this may result in an update of this node's children property, and we want to call it
         * here rather than later so if this modified the node it doesn't trigger an additional write.
         */
        svc_mongoRead.hasChildren(node);
        beforeSave(node);
        svc_ops.save(node);
    }

    public void saveIfDirtyAP(SubNode node) {
        if (node == null || !TL.hasDirtyNode(node.getId()))
            return;
        saveAP(node);
    }

    public void saveAP(SubNode node) {
        svc_arun.run(() -> {
            beforeSave(node);
            svc_ops.save(node);
            return null;
        });
    }

    public void saveSession() {
        saveSession(false);
    }

    public void saveSession(boolean asAdmin) {
        if (!TL.hasDirtyNodes()) {
            return;
        }

        if (TL.hasDirtyNodes()) {
            synchronized (TL.getDirtyNodes()) {
                try {
                    synchronized (TL.getSC()) {
                        TL.getDirtyNodes().forEach((key, value) -> {
                            if (!key.toHexString().equals(value.getIdStr())) {
                                throw new RuntimeEx("Node originally cached as ID " + key.toHexString()
                                        + " now has key" + value.getIdStr());
                            }
                        });

                        /*
                         * We use 'nodes' list to avoid a concurrent modification exception, because calling 'save()' on
                         * a node will have the side effect of removing it from dirtyNodes, and that can't happen during
                         * the loop below because we're iterating over dirtyNodes.
                         */
                        List<SubNode> nodes = new LinkedList<>();

                        // check that we are allowed to write all, before we start writing any
                        for (SubNode node : TL.getDirtyNodes().values()) {
                            if (!asAdmin) {
                                try {
                                    svc_auth.ownerAuth(node);
                                } catch (Exception e) {
                                    log.warn("Dirty node save attempt failed: " + XString.prettyPrint(node)
                                            + "\nSessionContext has user: " + TL.getSC().getUserName()
                                            + " and ThreadLocal session is: " + TL.getSC().getUserName());
                                }
                            }
                            nodes.add(node);
                        }

                        if (asAdmin) {
                            svc_arun.run(() -> {
                                for (SubNode node : nodes) {
                                    try {
                                        save(node);
                                    } catch (Exception e) {
                                        ExUtil.error(log, "Error saving node as admin: " + XString.prettyPrint(node),
                                                e);
                                    }
                                }
                                return null;
                            });
                        } else {
                            for (SubNode node : nodes) {
                                try {
                                    save(node);
                                } catch (Exception e) {
                                    ExUtil.error(log, "Error saving node: " + XString.prettyPrint(node), e);
                                }
                            }
                        }
                    }
                    log.debug("sync block for ms - exiting");
                } catch (Exception e) {
                    // don't rethrow any exceptions from in here.
                    ExUtil.error(log, "exception in call processor", e);
                }
            }
        }

    }

    public void resetChildrenState() {
        Query query = new Query();
        Update upd = new Update();
        upd.set(SubNode.HAS_CHILDREN, null);
        svc_ops.findAndModify(query, upd);
    }

    // returns a new BulkOps if one not yet existing
    public BulkOperations bulkOpSetPropVal(BulkOperations bops, ObjectId id, String prop, Object val,
            boolean addSecurity) {
        if (bops == null) {
            bops = svc_ops.bulkOps(BulkMode.UNORDERED);
        }
        Criteria crit = new Criteria("id").is(id);
        if (addSecurity) {
            crit = svc_auth.addWriteSecurity(crit);
        }
        Query query = new Query().addCriteria(crit);
        Update update = new Update().set(prop, val);
        bops.updateOne(query, update);
        return bops;
    }

    public BulkOperations bulkOpDelProp(BulkOperations bops, ObjectId id, String prop) {
        if (bops == null) {
            bops = svc_ops.bulkOps(BulkMode.UNORDERED);
        }
        Criteria crit = new Criteria("id").is(id);
        Query query = new Query().addCriteria(crit);
        Update update = new Update().unset(prop);
        bops.updateOne(query, update);
        return bops;
    }

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
                TL.requireAdminThread();
                node.setOwner(id);
            } else {
                if (svc_auth.getAdminSC() != null) {
                    ObjectId ownerId = svc_auth.getAdminSC().getUserNodeObjId();
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

        /*
         * New nodes can be given a path where they will allow the ID to play the role of the leaf 'name'
         * part of the path
         */
        if (node.getPath().endsWith("/?")) {
            String path = svc_mongoUtil.findAvailablePath(XString.removeLastChar(node.getPath()), null);
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
            nodeName = nodeName.replaceAll("[:~/]", "-");
            node.setName(nodeName);
        }
        svc_snUtil.removeDefaultProps(node);

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
        svc_attach.fixAllAttachmentMimes(node);

        // Since we're saving this node already make sure none of our setters above left
        // it flagged as dirty or it might unnecessarily get saved twice.
        TL.clean(node);
    }

    private void verifyParentExists(SubNode node, boolean isNew) {
        if (!node.getPath().startsWith(NodePath.PENDING_PATH_S) && TL.getParentCheckEnabled()
                && (isNew || node.verifyParentPath)) {
            try {
                svc_mongoRead.checkParentExists(node.getPath());
            } catch (Exception e) {
                node.setId(null);
                throw new RuntimeEx("Parent path did not exist: " + node.getPath());
            }
        }
    }

    /* To save a node you must own the node and have WRITE access to it's parent */
    private void saveAuthByThread(SubNode node, boolean isNew) {
        // during server init no auth is required.
        if (!MongoRepository.fullInit) {
            return;
        }

        if (TL.getSC() == null) {
            String msg = "No session context found for save";
            log.error(msg);
            throw new RuntimeException(msg);
        }

        if (TL.hasAdminPrivileges())
            return;
        // Must have write privileges to this node.
        svc_auth.ownerAuth(node);
        // only if this is creating a new node do we need to check that the parent will
        // allow it
        if (isNew && !node.getPath().startsWith(NodePath.PENDING_PATH_S)) {
            SubNode parent = svc_mongoRead.getParent(node);
            if (parent == null) {
                log.debug("This SAVE should get rejected (its parent is missing): " + XString.prettyPrint(node));

                /*
                 * Make MongoDB fail to save this by sabatoging the ID here. It's the only way to abort the save.
                 * Supposedly throwing the Exception which we do below, is supposed to abort saves but it's not
                 * working where as nullifying the ID does indeed abort the save.
                 */
                node.setId(null);
                throw new RuntimeEx("unable to get node parent: " + node.getParentPath());
            }

            svc_auth.writeAuth(parent);
            if (svc_acl.isAdminOwned(parent) && !TL.hasAdminPrivileges()) {
                // ditto note above about aborting the save
                node.setId(null);
                throw new ForbiddenException();
            }
        }
    }

    // iterates over 'q' setting prop=val on every PARENT node of all those nodes.
    public void bulkSetPropValOnParents(Query q, String prop, Object val, boolean addSecurity) {
        Val<BulkOperations> bops = new Val<>(null);
        IntVal batchSize = new IntVal();
        // this hash set just makes sure we only submit each val set once! No replicated
        // work.
        HashSet<ObjectId> parentIds = new HashSet<>();

        svc_ops.forEach(q, node -> {
            // lazy create bops
            if (!bops.hasVal()) {
                bops.setVal(svc_ops.bulkOps(BulkMode.UNORDERED));
            }

            SubNode parent = svc_mongoRead.getParentAP(node);
            if (parent != null && parentIds.add(parent.getId())) {
                // we have a known 'bops' in this one and don't lazy create so we don't care
                // about the return value of this call
                svc_mongoUpdate.bulkOpSetPropVal(bops.getVal(), parent.getId(), prop, val, addSecurity);
                batchSize.inc();
            }
            if (batchSize.getVal() > Const.MAX_BULK_OPS) {
                bops.getVal().execute();
                batchSize.setVal(0);
                bops.setVal(null);
            }
        });

        if (bops.hasVal()) {
            bops.getVal().execute();
        }
    }

    // NOTE: Note currently used
    public void bulkSetPropsByIdObjs(Collection<ObjectId> ids, String prop, Object val, boolean addSecurity) {
        BulkOperations bops = null;
        int batchSize = 0;

        for (ObjectId id : ids) {
            bops = svc_mongoUpdate.bulkOpSetPropVal(bops, id, prop, null, addSecurity);
            if (++batchSize > Const.MAX_BULK_OPS) {
                bops.execute();
                batchSize = 0;
                bops = null;
            }
        }
        if (bops != null) {
            bops.execute();
        }
    }

    // NOTE: Not currently used
    public void bulkSetPropsByIdStr(Collection<String> ids, String prop, Object val, boolean addSecurity) {
        BulkOperations bops = null;
        int batchSize = 0;

        for (String id : ids) {
            bops = svc_mongoUpdate.bulkOpSetPropVal(bops, new ObjectId(id), prop, null, addSecurity);
            if (++batchSize > Const.MAX_BULK_OPS) {
                bops.execute();
                batchSize = 0;
                bops = null;
            }
        }
        if (bops != null) {
            bops.execute();
        }
    }
}
