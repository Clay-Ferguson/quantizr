package quanta.mongo;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.BulkOperations.BulkMode;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.mongodb.bulk.BulkWriteResult;
import com.mongodb.client.result.DeleteResult;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.model.SubNode;
import quanta.rest.request.DeleteNodesRequest;
import quanta.rest.request.DeletePropertyRequest;
import quanta.rest.response.DeleteNodesResponse;
import quanta.rest.response.DeletePropertyResponse;
import quanta.util.Const;
import quanta.util.ThreadLocals;
import quanta.util.XString;
import quanta.util.val.IntVal;
import quanta.util.val.LongVal;
import quanta.util.val.Val;

/**
 * Performs the 'deletes' (as in CRUD) operations for deleting nodes in MongoDB
 */
@Component
public class MongoDelete extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(MongoDelete.class);

    /*
     * When a user is creating a new node we leave FIELD_MODIFY_TIME null until their first save of it
     * and during the time it's null no other users can see the node. However the user can also abandon
     * the browser or cancel the editing and orphan the node that way, and this method which we call
     * only at startup, cleans up any and all of the orphans
     */
    public void removeAbandonedNodes(MongoSession ms) {
        Query q = new Query();
        q.addCriteria(Criteria.where(SubNode.MODIFY_TIME).is(null));
        DeleteResult res = opsw.remove(ms, q);
        log.debug("Num abandoned nodes deleted: " + res.getDeletedCount());
    }

    /*
     * DO NOT DELETE
     *
     * (this is referenced elsewhere, and is not currently used but we DO WANT TO KEEP IT.) This assumes
     * the constraint violation is not caused by an orphan node being the duplicate, and actually
     * running this code is therefore only SAFE after running a full and complete orphan delete process.
     */
    public void removeFriendConstraintViolations(MongoSession ms) {
        Query q = new Query();
        // query for all FRIEND nodes (will represent both blocks and friends)
        Criteria crit = Criteria.where(SubNode.TYPE).is(NodeType.FRIEND.s());
        q.addCriteria(crit);
        HashSet<String> keys = new HashSet<>();
        Iterable<SubNode> nodes = opsw.find(ms, q);

        for (SubNode node : nodes) {
            if (node.getOwner() == null)
                continue;
            String key = node.getOwner().toHexString() + "-" + node.getStr(NodeProp.USER_NODE_ID);
            if (keys.contains(key)) {
                delete(ms, node);
            } else {
                keys.add(key);
            }
        }
        update.saveSession(ms);
    }

    /**
     * This method assumes security check is already done.
     */
    public long deleteUnderPath(MongoSession ms, String path) {
        Query q = new Query();
        q.addCriteria(Criteria.where(SubNode.PATH).regex(mongoUtil.regexSubGraph(path)));
        SubNode parent = read.getNode(ms, path);

        if (parent != null) {
            parent.setHasChildren(false);
        }
        DeleteResult res = opsw.remove(ms, q);
        return res.getDeletedCount();
    }

    public long simpleDeleteUnderPath(MongoSession ms, String path) {
        Query q = new Query();
        q.addCriteria(Criteria.where(SubNode.PATH).regex(mongoUtil.regexSubGraph(path)));
        DeleteResult res = opsw.remove(ms, q);
        return res.getDeletedCount();
    }

    // deletes without checking any security
    public void adminDelete(ObjectId id) {
        MongoSession as = auth.getAdminSession();
        opsw.remove(as, new Query().addCriteria(new Criteria("id").is(id)));
    }

    /**
     * Currently cleaning up GridFS orphans is done in gridMaintenanceScan() only, so when we delete one
     * or more nodes, potentially orphaning other nodes or GRID nodes (binary files), those orphans will
     * get cleaned up later on, but not synchronously or in this method.
     */
    public long delete(MongoSession ms, SubNode node, boolean childrenOnly) {
        auth.ownerAuth(ms, node);
        log.debug("Deleting under path: " + node.getPath());
        update.saveSession(ms);
        /*
         * First delete all the children of the node by using the path, knowing all their paths 'start with'
         * (as substring) this path. Note how efficient it is that we can delete an entire subgraph in one
         * single operation!
         */
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexSubGraph(node.getPath()));
        crit = auth.addWriteSecurity(ms, crit);
        q.addCriteria(crit);
        DeleteResult res = opsw.remove(ms, q);
        log.debug("Num of SubGraph deleted: " + res.getDeletedCount());
        long totalDelCount = res.getDeletedCount();
        /*
         * Yes we DO have to remove the node itself separate from the remove of all it's subgraph, because
         * in order to be perfectly safe the recursive subgraph regex MUST designate the slash AFTER the
         * root path to be sure we get the correct node, other wise deleting /ab would also delete /abc for
         * example. so we must have our recursive delete identify deleting "/ab" as starting with "/ab/"
         */
        if (!childrenOnly) {
            DeleteResult ret = delete(ms, node);
            totalDelCount += ret.getDeletedCount();
        } else {
            // if we're deleting children only we just update the node's hasChildren to false. We know there are
            // none
            node.setHasChildren(false);
        }
        return totalDelCount;
    }

    /*
     * Note: This method doesn't remove orphans of the node.
     */
    public DeleteResult delete(MongoSession ms, SubNode node) {
        SubNode parent = read.getParent(ms, node, false);
        if (parent != null) {
            parent.setHasChildren(null);
        }
        return opsw.remove(node);
    }

    public void directDelete(SubNode node) {
        opsw.remove(node);
    }

    public void deleteByPropVal(MongoSession ms, String prop, String val, boolean allowSecurity) {
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PROPS + "." + prop).is(val);
        crit = auth.addWriteSecurity(ms, crit);
        q.addCriteria(crit);

        // since we're deleting all nodes matching the query 'q' we set the parents of all those nodes do
        // unknown children state
        bulkSetPropValOnParents(ms, q, SubNode.HAS_CHILDREN, null, allowSecurity);
        // look for all calls to 'opsw.remove' just to doublecheck none of them need the above
        // 'bulkSetPropValOnParents'
        DeleteResult res = opsw.remove(ms, q);
        log.debug("Nodes deleted: " + res.getDeletedCount());
    }

    // iterates over 'q' setting prop=val on every PARENT node of all those nodes.
    public void bulkSetPropValOnParents(MongoSession ms, Query q, String prop, Object val, boolean addSecurity) {
        Val<BulkOperations> bops = new Val<>(null);
        IntVal batchSize = new IntVal();
        // this hash set just makes sure we only submit each val set once! No replicated work.
        HashSet<ObjectId> parentIds = new HashSet<>();

        opsw.forEach(q, node -> {
            // lazy create bops
            if (!bops.hasVal()) {
                bops.setVal(opsw.bulkOps(BulkMode.UNORDERED));
            }

            SubNode parent = read.getParent(ms, node, false);
            if (parent != null && parentIds.add(parent.getId())) {
                // we have a known 'bops' in this one and don't lazy create so we don't care about the
                // return value of this call
                update.bulkOpSetPropVal(ms, bops.getVal(), parent.getId(), prop, val, addSecurity);
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

    public void bulkSetPropsByIdObjs(MongoSession ms, Collection<ObjectId> ids, String prop, Object val,
            boolean addSecurity) {
        BulkOperations bops = null;
        int batchSize = 0;

        for (ObjectId id : ids) {
            bops = update.bulkOpSetPropVal(ms, bops, id, prop, null, addSecurity);
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

    public void bulkSetPropsByIdStr(MongoSession ms, Collection<String> ids, String prop, Object val,
            boolean addSecurity) {
        BulkOperations bops = null;
        int batchSize = 0;

        for (String id : ids) {
            bops = update.bulkOpSetPropVal(ms, bops, new ObjectId(id), prop, null, addSecurity);
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

    /*
     * This version of deleteNodeOrphans will run slower than the one below, but uses essentially no
     * memory
     */
    public void deleteNodeOrphans() {
        Val<BulkOperations> bops = new Val<>(null);
        LongVal totalDeleted = new LongVal();
        LongVal opsPending = new LongVal();
        LongVal deletesInPass = new LongVal();
        int passes = 0;

        // run up to 5 passes over the whole DB (orphan trees deeper than 5 levels deep
        // won't all be cleaned but that's ok, they will get pruned off in future runs.
        while (passes++ < 5) {
            // starting a new pass, so zero deletes so far in this pass
            deletesInPass.setVal(0L);
            // scan the entire DB
            opsw.forEach(new Query(), node -> {
                // if this node is root node, ignore
                if (NodePath.ROOT_PATH.equals(node.getPath()))
                    return;
                // if this node's parent is root, also ignore it.
                String parentPath = node.getParentPath();
                if (NodePath.ROOT_PATH.equals(parentPath))
                    return;
                // query to see if node's parent exists.
                Query q = new Query();
                q.addCriteria(Criteria.where(SubNode.PATH).is(parentPath));
                SubNode parent = opsw.findOne(null, q);

                // if parent node doesn't exist, this is an orphan we can delete.
                if (parent == null) {
                    // lazy create our bulk ops here.
                    if (bops.getVal() == null) {
                        bops.setVal(opsw.bulkOps(BulkMode.UNORDERED));
                    }
                    // add bulk ops command to delete this orphan
                    bops.getVal().remove(new Query().addCriteria(new Criteria("id").is(node.getId())));
                    // update counters
                    opsPending.inc();
                    deletesInPass.inc();
                    if (opsPending.getVal() > Const.MAX_BULK_OPS) {
                        BulkWriteResult results = bops.getVal().execute();
                        totalDeleted.add(results.getDeletedCount());
                        log.debug("DEL TOTAL: " + totalDeleted.getVal());
                        bops.setVal(null);
                        opsPending.setVal(0L);
                    }
                }
            });

            // after the DB scan is done delete the remainder left in ops pending
            if (opsPending.getVal() > 0) {
                BulkWriteResult results = bops.getVal().execute();
                totalDeleted.add(results.getDeletedCount());
                log.debug("remainders. DEL TOTAL: " + totalDeleted.getVal());
                bops.setVal(null);
                opsPending.setVal(0L);
            }
            if (deletesInPass.getVal() == 0L) {
                log.debug("no orphans found in last pass. done.");
                break;
            }
        }
        log.debug("TOTAL ORPHANS DELETED=" + totalDeleted.getVal());
    }

    /*
     * Deletes Orphan Nodes.
     *
     * Orphan nodes are ones that have a path whose parent path doesn't exist. This version of an
     * implementation requires ALL paths of all nodes to fit into RAM but there's an even simpler
     * approach that would be just to scan all nodes and for each one do the 'exist' check on it's
     * parent and delete those who don't have an existing parent.
     *
     * #optimization: Can add Verify & Repair HAS_CHILDREN in this method.
     *
     * Since every node looks for it's parent in this process we could theoretically use this to also
     * perfectly verify and/or repair every HAS_CHILDREN in the system. We'd just keep a list if which
     * nodes claim they DO have children in a HashSet of those ObjectIds, and then as we encounter each
     * one as a parent we "find" in this as we go along remove from the HashSet, as "correct" so that
     * whatever's left in said HashSet when the entire process is completed will be nodes that are known
     * to claim to have children and don't. Then do we do the 'inverse of that' to fix the nodes that
     * claim NOT to have children but DO have children...which would be a separate hash map doing the
     * same kind of logic.
     */
    public void deleteNodeOrphans_fast() {
        Val<BulkOperations> bops = new Val<>(null);
        IntVal nodesProcessed = new IntVal();
        LongVal opsPending = new LongVal();
        LongVal totalDeleted = new LongVal();
        // map every path to it's ObjectId
        HashMap<String, ObjectId> allNodes = new HashMap<>();
        // first all we do is build up the 'allNodes' hashMap.
        opsw.forEach(new Query(), node -> {
            // print progress every 1000th node
            nodesProcessed.inc();
            if (nodesProcessed.getVal() % 1000 == 0) {
                log.debug("SCAN: " + nodesProcessed.getVal());
            }
            allNodes.put(node.getPath(), node.getId());
        });
        nodesProcessed.setVal(0);
        int passes = 0;

        while (passes++ < 20) {
            log.debug("Running Orphan Pass: " + passes);
            LongVal deletesInPass = new LongVal();
            HashMap<String, ObjectId> orphans = new HashMap<>();
            // scan every node we still have and any whose parent is not also in the map is a known orphan
            allNodes.entrySet().stream().forEach(entry -> {
                nodesProcessed.inc();
                if (nodesProcessed.getVal() % 1000 == 0) {
                    log.debug("FINDER SCAN: " + nodesProcessed.getVal());
                }
                if (entry.getKey().equals(NodePath.ROOT_PATH)) {
                    return;
                }
                String parent = XString.truncAfterLast(entry.getKey(), "/");
                if (parent.equalsIgnoreCase(NodePath.ROOT_PATH)) {
                    return;
                }
                if (!allNodes.containsKey(parent)) {
                    log.debug("ORPH: " + entry.getValue().toHexString());
                    // put the stuff to delete in a separate map to avoid a concurrent modification exception
                    orphans.put(entry.getKey(), entry.getValue());
                }
            });
            // found no orphans at all then we're done.
            if (orphans.size() == 0) {
                log.debug("No more orphans found. Done!");
                // breaks out of while loop of 'passes'
                break;
            }

            // delete all orphans identified in this pass
            orphans.entrySet().stream().forEach(entry -> {
                // lazy create bops
                if (bops.getVal() == null) {
                    bops.setVal(opsw.bulkOps(BulkMode.UNORDERED));
                }
                allNodes.remove(entry.getKey());

                bops.getVal().remove(new Query().addCriteria(new Criteria("id").is(entry.getValue())));
                opsPending.inc();
                deletesInPass.inc();
                if (opsPending.getVal() > Const.MAX_BULK_OPS) {
                    BulkWriteResult results = bops.getVal().execute();
                    totalDeleted.add(results.getDeletedCount());
                    log.debug("DEL TOTAL: " + totalDeleted.getVal());
                    bops.setVal(null);
                    opsPending.setVal(0L);
                }
            });
            // since we delete in blocks of 100 at a time, we might have some left pending here so
            // finish deleting those
            if (opsPending.getVal() > 0) {
                BulkWriteResult results = bops.getVal().execute();
                totalDeleted.add(results.getDeletedCount());
                log.debug("remainders. DEL TOTAL: " + totalDeleted.getVal());
                bops.setVal(null);
                opsPending.setVal(0L);
            }
            log.debug("Deletes in Pass: " + deletesInPass.getVal());
        }
        log.debug("TOTAL ORPHANS DELETED=" + totalDeleted.getVal());
    }

    /*
     * Deletes the set of nodes specified in the request
     */
    public DeleteNodesResponse deleteNodes(MongoSession ms, List<String> nodeIds) {
        DeleteNodesResponse res = new DeleteNodesResponse();
        SubNode userNode = read.getAccountByUserName(null, null, false);
        if (userNode == null) {
            throw new RuntimeEx("User not found.");
        }
        BulkOperations bops = null;
        List<SubNode> nodes = new LinkedList<>();
        HashSet<ObjectId> parentIds = new HashSet<>();
        int batchSize = 0;

        for (String nodeId : nodeIds) {
            // lookup the node we're going to delete, we call with allowAuth, becasuse it would be redundant
            // since the next thing we do is an 'ownerAuth', which is even more restrictive
            SubNode node = read.getNode(ms, nodeId, false, null);
            if (node == null)
                continue;
            auth.ownerAuth(ms, node);
            read.hasChildrenConsistencyCheck(ms, node);

            // get the parent of the node and add it's id to parentIds
            SubNode parent = read.getParent(ms, node, false);

            // back out the number of bytes it was using
            if (!ms.isAdmin()) {
                long totalBytes = attach.getTotalAttachmentBytes(ms, node);
                user.addBytesToUserNodeBytes(ms, -totalBytes, userNode);
            }
            nodes.add(node);

            /*
             * if 'add' returns true that means this IS the first encounter and so we add to the operations the
             * call to set it's hasChildren to null. Note setting HAS_CHILDREN to null doesn't indicate we think
             * there's no chilren it indicates we don't KNOW if it still has children or not.
             */
            if (parent != null && parentIds.add(parent.getId())) {
                bops = update.bulkOpSetPropVal(ms, bops, parent.getId(), SubNode.HAS_CHILDREN, null, false);
            }
            /*
             * we remove the actual specified nodes synchronously here (instead of including root in
             * deleteSubGraphChildren below), so that the client can refresh as soon as it wants and get back
             * correct results.
             */
            bops = bulkOpRemoveNode(ms, bops, node.getId());
            if (++batchSize > Const.MAX_BULK_OPS) {
                bops.execute();
                batchSize = 0;
                bops = null;
            }
        }

        // in async thread send out all the deletes to the foreign servers, and then delete the subgraphs
        // under the deleted nodes so there should be no orphans left
        exec.run(() -> {
            nodes.forEach(n -> {
                deleteSubGraphChildren(ms, n, false);
            });
        });
        if (bops != null) {
            bops.execute();
        }
        update.saveSession(ms);
        return res;
    }

    /*
     * Note: this method assumes that the user associated with 'ms' already has been checked for
     * authorization to delete 'node' (owns the node)
     */
    public void deleteSubGraphChildren(MongoSession ms, SubNode node, boolean includeRoot) {
        if (includeRoot) {
            // it's ok to call ops and not opsw here
            opsw.remove(node);
        }
        Query q = new Query();
        log.debug("DEL SUBGRAPH: " + node.getPath());
        Criteria crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexSubGraph(node.getPath()));
        q.addCriteria(crit);
        opsw.remove(ms, q);
    }

    // returns a new BulkOps if one not yet existing
    public BulkOperations bulkOpRemoveNode(MongoSession ms, BulkOperations bops, ObjectId id) {
        if (bops == null) {
            bops = opsw.bulkOps(BulkMode.UNORDERED);
        }
        Criteria crit = new Criteria("id").is(id);
        crit = auth.addWriteSecurity(ms, crit);
        Query query = new Query().addCriteria(crit);
        bops.remove(query);
        return bops;
    }

    /*
     * Deletes the set of nodes specified in the request
     */
    public DeleteNodesResponse bulkDeleteNodes(MongoSession ms) {
        DeleteNodesResponse res = new DeleteNodesResponse();
        SubNode userNode = read.getAccountByUserName(null, null, false);
        if (userNode == null) {
            throw new RuntimeEx("User not found.");
        }
        Query q = new Query();
        // criteria finds all nodes where we are the owner but they're not decendants under our own tree
        // root of our account
        Criteria crit = Criteria.where(SubNode.OWNER).is(userNode.getOwner())//
                .and(SubNode.PATH).not().regex(mongoUtil.regexSubGraphAndRoot(userNode.getPath()));

        q.addCriteria(crit);
        // we'll be deleting every node in 'q' so we need to set the parents of all those to
        // hasChildren=null (unknown)
        bulkSetPropValOnParents(ms, q, SubNode.HAS_CHILDREN, null, false);

        // This will potentially leave orphans and this is fine. We don't bother cleaning orphans now
        // because there's no need.
        DeleteResult delRes = opsw.remove(ms, q);
        String msg = "Nodes deleted: " + delRes.getDeletedCount();
        log.debug("Bulk Delete: " + msg);
        res.setMessage(msg);
        return res;
    }

    public DeleteNodesResponse cm_delete(DeleteNodesRequest req, MongoSession ms) {
        DeleteNodesResponse res = null;
        String jumpTarget = null;

        if (!StringUtils.isEmpty(req.getJumpToParentOf())) {
            SubNode node = read.getNode(ms, req.getJumpToParentOf());
            if (node == null) {
                throw new RuntimeEx("Node node not found.");
            }
            SubNode parent = read.getParent(ms, node, false);

            if (parent != null && auth.ownedBy(ThreadLocals.getSC(), parent)) {
                jumpTarget = parent.getIdStr();
            }
        }

        if (req.isBulkDelete()) {
            res = delete.bulkDeleteNodes(ms);
        } else {
            res = delete.deleteNodes(ms, req.getNodeIds());
        }
        res.setJumpTargetId(jumpTarget);
        return res;
    }

    /*
     * Removes the property specified in the request from the node specified in the request
     */
    @Transactional("mongoTm")
    public DeletePropertyResponse cm_deleteProperties(MongoSession ms, DeletePropertyRequest req) {
        DeletePropertyResponse res = new DeletePropertyResponse();
        String nodeId = req.getNodeId();
        SubNode node = read.getNode(ms, nodeId);
        auth.ownerAuth(node);

        for (String propName : req.getPropNames()) {
            node.delete(propName);
        }
        update.save(ms, node);
        return res;
    }
}
