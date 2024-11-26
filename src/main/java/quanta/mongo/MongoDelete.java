package quanta.mongo;

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
import com.mongodb.bulk.BulkWriteResult;
import com.mongodb.client.result.DeleteResult;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.exception.base.RuntimeEx;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;
import quanta.rest.request.DeleteNodesRequest;
import quanta.rest.request.DeletePropertyRequest;
import quanta.rest.response.DeleteNodesResponse;
import quanta.rest.response.DeletePropertyResponse;
import quanta.util.Const;
import quanta.util.TL;
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
    public void removeAbandonedNodes() {
        Query q = new Query();
        q.addCriteria(Criteria.where(SubNode.MODIFY_TIME).is(null));
        DeleteResult res = svc_ops.remove(q);
        log.debug("Num abandoned nodes deleted: " + res.getDeletedCount());
    }

    /**
     * This method assumes security check is already done.
     */
    public long deleteUnderPath(String path) {
        Query q = new Query();
        q.addCriteria(svc_mongoUtil.subGraphCriteria(path));
        SubNode parent = svc_mongoRead.getNode(path);
        svc_auth.writeAuth(parent);
        if (parent != null) {
            parent.setHasChildren(false);
        }
        DeleteResult res = svc_ops.remove(q);
        return res.getDeletedCount();
    }

    public long simpleDeleteUnderPath(String path) {
        Query q = new Query();
        q.addCriteria(svc_mongoUtil.subGraphCriteria(path));
        DeleteResult res = svc_ops.remove(q);
        return res.getDeletedCount();
    }

    // deletes without checking any security
    public void adminDelete(ObjectId id) {
        svc_arun.run(() -> {
            svc_ops.remove(new Query().addCriteria(new Criteria("id").is(id)));
            return null;
        });
    }

    /**
     * Currently cleaning up GridFS orphans is done in gridMaintenanceScan() only, so when we delete one
     * or more nodes, potentially orphaning other nodes or GRID nodes (binary files), those orphans will
     * get cleaned up later on, but not synchronously or in this method.
     */
    public long delete(SubNode node, boolean childrenOnly) {
        svc_auth.ownerAuth(node);
        log.debug("Deleting under path: " + node.getPath());
        svc_mongoUpdate.saveSession();
        /*
         * First delete all the children of the node by using the path, knowing all their paths 'start with'
         * (as substring) this path. Note how efficient it is that we can delete an entire subgraph in one
         * single operation!
         */
        Query q = new Query();
        Criteria crit = svc_mongoUtil.subGraphCriteria(node.getPath());
        crit = svc_auth.addWriteSecurity(crit);
        q.addCriteria(crit);
        DeleteResult res = svc_ops.remove(q);
        log.debug("Num of SubGraph deleted: " + res.getDeletedCount());
        long totalDelCount = res.getDeletedCount();
        /*
         * Yes we DO have to remove the node itself separate from the remove of all it's subgraph, because
         * in order to be perfectly safe the recursive subgraph regex MUST designate the slash AFTER the
         * root path to be sure we get the correct node, other wise deleting /ab would also delete /abc for
         * example. so we must have our recursive delete identify deleting "/ab" as starting with "/ab/"
         */
        if (!childrenOnly) {
            DeleteResult ret = delete(node);
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
    public DeleteResult delete(SubNode node) {
        SubNode parent = svc_mongoRead.getParentAP(node);
        if (parent != null) {
            svc_auth.ownerAuth(parent);
            parent.setHasChildren(null);
        }
        return svc_ops.remove(node);
    }

    public void directDelete(SubNode node) {
        svc_ops.remove(node);
    }

    /**
     * Deletes all nodes that have a property with a specific value.
     */
    public void deleteByPropVal(String prop, String val, boolean allowSecurity) {
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PROPS + "." + prop).is(val);
        crit = svc_auth.addWriteSecurity(crit);
        q.addCriteria(crit);

        // since we're deleting all nodes matching the query 'q' we set the parents of all those nodes do
        // unknown children state
        svc_mongoUpdate.bulkSetPropValOnParents(q, SubNode.HAS_CHILDREN, null, allowSecurity);
        // look for all calls to 'opsw.remove' just to doublecheck none of them need the above
        // 'bulkSetPropValOnParents'
        DeleteResult res = svc_ops.remove(q);
        log.debug("Nodes deleted: " + res.getDeletedCount());
    }

    /*
     * This version of deleteNodeOrphans will run slower than the one below, but uses essentially no
     * memory
     */
    public String deleteNodeOrphans() {
        String msg = "## Orphan Nodes Cleanup\n";
        MongoTranMgr.ensureTran();
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
            svc_ops.forEach(new Query(), node -> {
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
                SubNode parent = svc_ops.findOne(q);

                // if parent node doesn't exist, this is an orphan we can delete.
                if (parent == null) {
                    // lazy create our bulk ops here.
                    if (bops.getVal() == null) {
                        bops.setVal(svc_ops.bulkOps(BulkMode.UNORDERED));
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
        msg += "\n```\nTOTAL DELETED=" + totalDeleted.getVal() + "\n```\n";
        return msg;
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
        svc_ops.forEach(new Query(), node -> {
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
                    bops.setVal(svc_ops.bulkOps(BulkMode.UNORDERED));
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
        log.debug("TOTAL DELETED: " + totalDeleted.getVal());
    }

    public DeleteNodesResponse preDeleteCheck(List<String> nodeIds) {
        SessionContext sc = TL.getSC();
        int mineCount = 0;
        int otherCount = 0; // count nodes that are not mine
        boolean subgraphsExist = false;

        if (sc == null) {
            throw new RuntimeEx("User not found.");
        }

        for (String nodeId : nodeIds) {
            SubNode node = svc_mongoRead.getNode(nodeId);

            // check if node is mine
            if (svc_auth.ownedBy(sc, node)) {
                mineCount++;
            } else {
                if (!sc.isAdmin()) {
                    throw new RuntimeEx("You can't delete a node that you don't own.");
                }
            }

            Iterable<SubNode> results = svc_arun.run(() -> svc_mongoRead.getSubGraph(node, null, 0, false, null));
            for (SubNode n : results) {
                subgraphsExist = true;
                // check if node is mine
                if (svc_auth.ownedBy(sc, n)) {
                    mineCount++;
                } else {
                    otherCount++;
                }
            }
        }

        if (subgraphsExist || otherCount > 0) {
            DeleteNodesResponse res = new DeleteNodesResponse();
            String warning = "You are about to delete " + String.valueOf(mineCount + otherCount) + " nodes. ";
            if (otherCount > 0)
                warning += String.valueOf(otherCount) + " of them are owned by other users.";
            res.setWarning(warning);
            return res;
        }
        return null;
    }

    /*
     * Deletes the set of nodes specified in the request
     */
    public DeleteNodesResponse deleteNodes(boolean force, List<String> nodeIds) {
        if (!force) {
            DeleteNodesResponse res = preDeleteCheck(nodeIds);
            if (res != null) {
                return res;
            }
        }

        DeleteNodesResponse res = new DeleteNodesResponse();
        AccountNode userNode = svc_user.getSessionUserAccount();
        if (userNode == null) {
            throw new RuntimeEx("User not found.");
        }
        BulkOperations bops = null;
        List<SubNode> nodes = new LinkedList<>();
        HashSet<ObjectId> parentIds = new HashSet<>();
        int batchSize = 0;

        for (String nodeId : nodeIds) {
            SubNode node = svc_mongoRead.getNodeAP(nodeId);
            if (node == null)
                continue;
            svc_publication.cacheRemove(node, false);
            svc_auth.ownerAuth(node);
            svc_mongoRead.hasChildrenConsistencyCheck(node);

            // get the parent of the node and add it's id to parentIds
            SubNode parent = svc_mongoRead.getParentAP(node);

            // back out the number of bytes it was using
            if (!TL.hasAdminPrivileges()) {
                long totalBytes = svc_attach.getTotalAttachmentBytes(node);
                svc_user.addBytesToUserNodeBytes(-totalBytes, userNode);
            }
            nodes.add(node);

            /*
             * if 'add' returns true that means this IS the first encounter and so we add to the operations the
             * call to set it's hasChildren to null. Note setting HAS_CHILDREN to null doesn't indicate we think
             * there's no chilren it indicates we don't KNOW if it still has children or not.
             */
            if (parent != null && parentIds.add(parent.getId())) {
                bops = svc_mongoUpdate.bulkOpSetPropVal(bops, parent.getId(), SubNode.HAS_CHILDREN, null, false);
            }
            /*
             * we remove the actual specified nodes synchronously here (instead of including root in
             * deleteSubGraphChildren below), so that the client can refresh as soon as it wants and get back
             * correct results.
             */
            bops = bulkOpRemoveNode(bops, node.getId());
            if (++batchSize > Const.MAX_BULK_OPS) {
                bops.execute();
                batchSize = 0;
                bops = null;
            }
        }

        // in async thread send out all the deletes to the foreign servers, and then delete the subgraphs
        // under the deleted nodes so there should be no orphans left
        svc_async.run(() -> {
            nodes.forEach(n -> {
                deleteSubGraphChildren(n, false);
            });
        });
        if (bops != null) {
            bops.execute();
        }
        svc_mongoUpdate.saveSession();
        return res;
    }

    /*
     * Note: this method assumes that the user associated with 'ms' already has been checked for
     * authorization to delete 'node' (owns the node)
     */
    public void deleteSubGraphChildren(SubNode node, boolean includeRoot) {
        if (includeRoot) {
            // it's ok to call ops and not opsw here
            svc_ops.remove(node);
        }
        Query q = new Query();
        log.debug("DEL SUBGRAPH: " + node.getPath());
        Criteria crit = svc_mongoUtil.subGraphCriteria(node.getPath());
        q.addCriteria(crit);
        svc_ops.remove(q);
    }

    // returns a new BulkOps if one not yet existing
    public BulkOperations bulkOpRemoveNode(BulkOperations bops, ObjectId id) {
        if (bops == null) {
            bops = svc_ops.bulkOps(BulkMode.UNORDERED);
        }
        Criteria crit = new Criteria("id").is(id);
        crit = svc_auth.addWriteSecurity(crit);
        Query query = new Query().addCriteria(crit);
        bops.remove(query);
        return bops;
    }

    public DeleteNodesResponse bulkDeleteNodes() {
        DeleteNodesResponse res = new DeleteNodesResponse();
        AccountNode userNode = svc_user.getSessionUserAccount();
        if (userNode == null) {
            throw new RuntimeEx("User not found.");
        }
        Query q = new Query();
        // criteria finds all nodes where we are the owner but they're not decendants under our own tree
        // root of our account
        Criteria crit = Criteria.where(SubNode.OWNER).is(userNode.getOwner())//
                .and(SubNode.PATH).not().regex(svc_mongoUtil.regexSubGraphAndRoot(userNode.getPath()));

        q.addCriteria(crit);
        // we'll be deleting every node in 'q' so we need to set the parents of all those to
        // hasChildren=null (unknown)
        svc_mongoUpdate.bulkSetPropValOnParents(q, SubNode.HAS_CHILDREN, null, false);

        // This will potentially leave orphans and this is fine. We don't bother cleaning orphans now
        // because there's no need.
        DeleteResult delRes = svc_ops.remove(q);
        String msg = "Nodes deleted: " + delRes.getDeletedCount();
        log.debug("Bulk Delete: " + msg);
        res.setMessage(msg);
        return res;
    }

    public DeleteNodesResponse cm_delete(DeleteNodesRequest req) {
        DeleteNodesResponse res = null;
        String jumpTarget = null;

        if (!StringUtils.isEmpty(req.getJumpToParentOf())) {
            SubNode node = svc_mongoRead.getNode(req.getJumpToParentOf());
            if (node == null) {
                throw new RuntimeEx("Node node not found.");
            }
            SubNode parent = svc_mongoRead.getParentAP(node);

            if (parent != null && svc_auth.ownedBy(TL.getSC(), parent)) {
                jumpTarget = parent.getIdStr();
            }
        }

        if (req.isBulkDelete()) {
            res = svc_mongoDelete.bulkDeleteNodes();
        } else {
            res = svc_mongoDelete.deleteNodes(req.isForce(), req.getNodeIds());
        }
        res.setJumpTargetId(jumpTarget);
        return res;
    }

    /*
     * Removes the property specified in the request from the node specified in the request
     */
    public DeletePropertyResponse deleteProperties(DeletePropertyRequest req) {
        DeletePropertyResponse res = new DeletePropertyResponse();
        String nodeId = req.getNodeId();
        SubNode node = svc_mongoRead.getNode(nodeId);
        svc_auth.ownerAuth(node);

        for (String propName : req.getPropNames()) {
            node.delete(propName);
        }
        svc_mongoUpdate.save(node);
        return res;
    }
}
