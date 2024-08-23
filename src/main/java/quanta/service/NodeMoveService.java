package quanta.service;

import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.BulkOperations.BulkMode;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.client.NodeProp;
import quanta.mongo.MongoTranMgr;
import quanta.mongo.model.SubNode;
import quanta.rest.request.JoinNodesRequest;
import quanta.rest.request.MoveNodesRequest;
import quanta.rest.request.SelectAllNodesRequest;
import quanta.rest.request.SetNodePositionRequest;
import quanta.rest.response.JoinNodesResponse;
import quanta.rest.response.MoveNodesResponse;
import quanta.rest.response.SelectAllNodesResponse;
import quanta.rest.response.SetNodePositionResponse;
import quanta.rest.response.base.NodeChanges;
import quanta.util.Const;
import quanta.util.TL;

/**
 * Service for controlling the positions (ordinals) of nodes relative to their parents and/or moving
 * nodes to locate them under a different parent. This is similar type of functionality to
 * cut-and-paste in file systems. Currently there is no way to 'clone' or copy nodes, but user can
 * move any existing nodes they have to any new location they want, subject to security constraints
 * of course.
 */
@Component
public class NodeMoveService extends ServiceBase {
    @SuppressWarnings("unused")
    private static Logger log = LoggerFactory.getLogger(NodeMoveService.class);

    /*
     * Moves the the node to a new ordinal/position location (relative to parent)
     *
     * We allow the special case of req.siblingId="[topNode]" and that indicates move the node to be the
     * first node under its parent.
     */
    public SetNodePositionResponse setNodePosition(SetNodePositionRequest req) {
        MongoTranMgr.ensureTran();
        SetNodePositionResponse res = new SetNodePositionResponse();
        NodeChanges nodeChanges = new NodeChanges();
        res.setNodeChanges(nodeChanges);
        String nodeId = req.getNodeId();
        SubNode node = svc_mongoRead.getNode(nodeId);
        svc_auth.ownerAuth(node);
        if (node == null) {
            throw new RuntimeEx("Node not found: " + nodeId);
        }

        switch (req.getTargetName()) {
            case "up":
                moveNodeUp(node);
                break;
            case "down":
                moveNodeDown(node);
                break;
            case "top":
                moveNodeToTop(node, nodeChanges);
                break;
            case "bottom":
                moveNodeToBottom(node);
                break;
            default:
                throw new RuntimeEx("Invalid target type: " + req.getTargetName());
        }
        return res;
    }

    public void moveNodeUp(SubNode node) {
        SubNode nodeAbove = svc_mongoRead.getSiblingAbove(node, null);
        if (nodeAbove != null) {
            Long saveOrdinal = nodeAbove.getOrdinal();
            nodeAbove.setOrdinal(node.getOrdinal());
            node.setOrdinal(saveOrdinal);
        }
        svc_mongoUpdate.saveSession();
    }

    public void moveNodeDown(SubNode node) {
        SubNode nodeBelow = svc_mongoRead.getSiblingBelow(node, null);
        if (nodeBelow != null) {
            Long saveOrdinal = nodeBelow.getOrdinal();
            nodeBelow.setOrdinal(node.getOrdinal());
            node.setOrdinal(saveOrdinal);
        }
        svc_mongoUpdate.saveSession();
    }

    public void moveNodeToTop(SubNode node, NodeChanges nodeChanges) {
        SubNode parentNode = svc_mongoRead.getParent(node);
        if (parentNode == null) {
            return;
        }
        svc_mongoCreate.insertOrdinal(parentNode, 0L, 1L, nodeChanges);
        /*
         * todo-2: there is a slight ineffieiency here in that 'node' does end up getting saved both as part
         * of the insertOrdinal, and also then with the setting of it to zero. Will be easy to fix when I
         * get to it.
         */
        svc_mongoUpdate.saveSession();
        node.setOrdinal(0L);
        svc_mongoUpdate.saveSession();
    }

    public void moveNodeToBottom(SubNode node) {
        SubNode parentNode = svc_mongoRead.getParent(node);
        if (parentNode == null) {
            return;
        }
        long ordinal = svc_mongoRead.getMaxChildOrdinal(parentNode) + 1L;
        node.setOrdinal(ordinal);
        svc_mongoUpdate.saveSession();
    }

    /*
     * Note: Browser can send nodes in any order, in the request, and always the lowest ordinal is the
     * one we keep and join to.
     * 
     * If join to parent is true, that means we merge all the NodeIds onto their parent.
     */
    public JoinNodesResponse cm_joinNodes(JoinNodesRequest req) {
        JoinNodesResponse res = new JoinNodesResponse();
        LinkedList<String> delIds = new LinkedList<>();
        // add to list because we will sort
        ArrayList<SubNode> nodes = new ArrayList<SubNode>();
        String parentPath = null;

        // scan all nodes to verify we own them all, and they're all under same parent, and load all into
        // 'nodes'
        for (String nodeId : req.getNodeIds()) {
            SubNode node = svc_mongoRead.getNode(nodeId);
            if (parentPath == null) {
                parentPath = node.getParentPath();
            } //
            else if (!req.isJoinToParent() && !parentPath.equals(node.getParentPath())) {
                res.error("Failed: All nodes must be under the same parent node.");
                return res;
            }
            svc_auth.ownerAuth(node);
            if (svc_mongoRead.hasChildren(node)) {
                res.error("Failed. Nodes to be joined cannot have any children/subnodes");
                return res;
            }
            nodes.add(node);
        }
        nodes.sort((s1, s2) -> (int) (s1.getOrdinal() - s2.getOrdinal()));
        StringBuilder sb = new StringBuilder();
        SubNode targetNode = null;
        int counter = 0;

        for (SubNode n : nodes) {
            if (targetNode == null) {
                if (req.isJoinToParent()) {
                    targetNode = svc_mongoRead.getParent(n);
                    if (targetNode == null) {
                        throw new RuntimeException("Failed to find parent of node: " + n.getIdStr());
                    }
                } else {
                    targetNode = n;
                }
            }
            if (counter > 0) {
                sb.append("\n");
            }
            if (!StringUtils.isEmpty(n.getContent())) {
                // trim and add ONE new line, for consistency.
                sb.append(n.getContent().trim());
                sb.append("\n");
            }
            // counter > 0 means we have a firstNode but are NOT now processing first node.
            if (counter > 0 || req.isJoinToParent()) {
                svc_attach.mergeAttachments(n, targetNode);
                delIds.add(n.getIdStr());
            }
            counter++;
        }

        if (req.isJoinToParent()) {
            targetNode.setContent(targetNode.getContent() + "\n\n" + sb.toString());
        } else {
            targetNode.setContent(sb.toString());
        }
        targetNode.touch();
        svc_mongoUpdate.saveSession();

        // todo-1: this is really slightly dangerous. We need to probably run with force=false first, and throw back warnings to the user
        // and roll this transaction back of there are warnings that the user will be destroying subnode content by doing this join function.
        // Better yet, really if there are subnodes at all we should just fail to join and throw exception.
        svc_mongoDelete.deleteNodes(true, delIds);
        return res;
    }

    /*
     * Moves a set of nodes to a new location, underneath (i.e. children of) the target node specified.
     */
    public MoveNodesResponse moveNodes(MoveNodesRequest req) {
        MongoTranMgr.ensureTran();
        MoveNodesResponse res = new MoveNodesResponse();
        moveNodesInternal(req.getLocation(), req.getTargetNodeId(), req.getNodeIds(), req.isCopyPaste(), res);
        return res;
    }

    /*
     * If req.location==inside then the targetId is the parent node we will be inserting children into,
     * but if req.location==inline the targetId represents the child who will become a sibling of what
     * we are inserting, and the inserted nodes will be pasted in directly below that ordinal (i.e. new
     * siblings posted in below it)
     */
    private void moveNodesInternal(String location, String targetId, List<String> nodeIds,
            boolean copyPaste, MoveNodesResponse res) {
        if (nodeIds == null || nodeIds.size() == 0) {
            throw new RuntimeException("No nodes specified to move.");
        }
        NodeChanges nodeChanges = new NodeChanges();
        res.setNodeChanges(nodeChanges);
        // get targetNode which is node we're pasting at or into.
        SubNode targetNode = svc_mongoRead.getNode(targetId);
        SubNode parentToPasteInto =
                location.equalsIgnoreCase("inside") ? targetNode : svc_mongoRead.getParent(targetNode);
        svc_auth.ownerAuth(parentToPasteInto);
        String parentPath = parentToPasteInto.getPath();
        Long curTargetOrdinal = null;

        if (location != null) {
            switch (location.toLowerCase()) {
                case "inside":
                    curTargetOrdinal = svc_mongoRead.getMaxChildOrdinal(targetNode) + 1;
                    break;
                case "inline":
                    curTargetOrdinal = targetNode.getOrdinal() + 1;
                    svc_mongoCreate.insertOrdinal(parentToPasteInto, curTargetOrdinal, nodeIds.size(), nodeChanges);
                    break;
                case "inline-above":
                    curTargetOrdinal = targetNode.getOrdinal();
                    svc_mongoCreate.insertOrdinal(parentToPasteInto, curTargetOrdinal, nodeIds.size(), nodeChanges);
                    break;
                default:
                    break;
            }
        }

        String sourceParentPath = null;
        List<SubNode> nodesToMove = new ArrayList<SubNode>();
        SubNode nodeParent = null;

        for (String nodeId : nodeIds) {
            SubNode node = svc_mongoRead.getNode(nodeId);
            svc_auth.ownerAuth(node);
            // log.debug("Will be Moving ID (and children of): " + nodeId + " path: " + node.getPath());
            nodesToMove.add(node);

            // Verify all nodes being pasted are siblings
            if (sourceParentPath != null && !sourceParentPath.equals(node.getParentPath())) {
                throw new RuntimeException("Nodes to move must be all from the same parent.");
            }
            sourceParentPath = node.getParentPath();
            // get the nodeParent if we don't have it already.
            if (nodeParent == null) {
                // Very important, we can get the parent even without having ownership of it here.
                nodeParent = svc_mongoRead.getParentAP(node);
            }
        }

        // make sure nodes to move are in ordinal order.
        nodesToMove.sort((n1, n2) -> (int) (n1.getOrdinal() - n2.getOrdinal()));

        // process all nodes being moved.
        for (SubNode node : nodesToMove) {
            Long _targetOrdinal = curTargetOrdinal;
            SubNode _nodeParent = nodeParent;
            svc_arun.run(() -> {
                // if a parent node is attempting to be pasted into one of it's children that's an impossible move
                // so we reject the attempt.
                if (parentToPasteInto.getPath().startsWith(node.getPath() + "/")) {
                    throw new RuntimeException("Impossible node move requested.");
                }
                // find any new Path available under the paste target location 'parentPath'
                String newPath = svc_mongoUtil.findAvailablePath(parentPath + "/");
                changePathOfSubGraph(node, node.getPath(), newPath, copyPaste, res);
                node.setPath(newPath);

                // crypto sig uses path as part of it, so we just invalidated the signature.
                if (node.getStr(NodeProp.CRYPTO_SIG) != null) {
                    node.delete(NodeProp.CRYPTO_SIG);
                    if (res != null) {
                        res.setSignaturesRemoved(true);
                    }
                }
                // verifyParentPath=false signals to MongoListener to not waste cycles checking the path on this
                // to verify the parent exists upon saving, because we know the path is fine.
                node.verifyParentPath = false;

                // If this 'node' will be changing parents (moving to new parent)
                if (!_nodeParent.getPath().equals(parentToPasteInto.getPath())) {
                    // we know this tareget node has chilren now.
                    parentToPasteInto.setHasChildren(true);
                    // only if we get here do we know the original parent (moved FROM) now has an indeterminate
                    // hasChildren status
                    _nodeParent.setHasChildren(null);
                }

                // do processing for when ordinal has changed.
                if (!node.getOrdinal().equals(_targetOrdinal)) {
                    node.setOrdinal(_targetOrdinal);
                    // we know this tareget node has chilren now.
                    parentToPasteInto.setHasChildren(true);
                }

                // this is only experimental and not correct yet.
                if (copyPaste) {
                    TL.clean(node);
                    node.setId(null);
                    node.setAttachments(null);

                    try {
                        TL.setParentCheckEnabled(false);
                        svc_mongoUpdate.save(node);
                    } finally {
                        TL.setParentCheckEnabled(true);
                    }
                }
                return null;
            });
            curTargetOrdinal++;
        }
    }

    /*
     * WARNING: This does NOT affect the path of 'graphRoot' itself, but only changes the location of
     * all the children under it
     */
    public void changePathOfSubGraph(SubNode graphRoot, String oldPathPrefix, String newPathPrefix,
            boolean copyPaste, MoveNodesResponse res) {
        String originalPath = graphRoot.getPath();
        BulkOperations bops = null;
        int batchSize = 0;

        for (SubNode node : svc_mongoRead.getSubGraphAP(graphRoot, null, 0, false, null)) {
            if (!node.getPath().startsWith(originalPath)) {
                throw new RuntimeEx(
                        "Algorighm failure: path " + node.getPath() + " should have started with " + originalPath);
            }

            String newPath = node.getPath().replace(oldPathPrefix, newPathPrefix);

            // this is only experimental and not correct yet.
            if (copyPaste) {
                node.setId(null);
                node.setAttachments(null);
                node.setPath(newPath);
                node.verifyParentPath = false;
                try {
                    TL.setParentCheckEnabled(false);
                    svc_mongoUpdate.save(node);
                } finally {
                    TL.setParentCheckEnabled(true);
                }
                continue;
            }

            if (bops == null) {
                bops = svc_ops.bulkOps(BulkMode.UNORDERED);
            }

            Criteria crit = new Criteria("id").is(node.getId());
            crit = svc_auth.addWriteSecurity(crit);
            Query query = new Query().addCriteria(crit);
            Update update = new Update().set(SubNode.PATH, newPath);

            if (node.getStr(NodeProp.CRYPTO_SIG) != null) {
                // crypto sig uses path as part of it, so we just invalidated the signature.
                node.getProps().remove(NodeProp.CRYPTO_SIG.s());
                update.set(SubNode.PROPS, node.getProps());
                res.setSignaturesRemoved(true);
            }

            bops.updateOne(query, update);
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

    public SelectAllNodesResponse cm_selectAllNodes(SelectAllNodesRequest req) {
        SelectAllNodesResponse res = new SelectAllNodesResponse();
        String nodeId = req.getParentNodeId();
        SubNode node = svc_mongoRead.getNode(nodeId);
        List<String> nodeIds = svc_mongoRead.getChildrenIds(node, false, null);
        if (nodeIds != null) {
            res.setNodeIds(nodeIds);
        }
        return res;
    }
}
