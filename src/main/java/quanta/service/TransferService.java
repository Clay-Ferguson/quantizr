package quanta.service;

import java.util.Arrays;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.client.Constant;
import quanta.model.client.PrivilegeType;
import quanta.model.client.TransferOp;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.TransferNodeRequest;
import quanta.response.TransferNodeResponse;
import quanta.util.val.IntVal;

@Component
public class TransferService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(TransferService.class);

    // todo-2: need to be doing a bulk update in here.
    public TransferNodeResponse transferNode(MongoSession ms, TransferNodeRequest req) {
        TransferNodeResponse res = new TransferNodeResponse();
        // make sure only admin will be allowed to specify some arbitrary "fromUser"
        if (!ms.isAdmin()) {
            req.setFromUser(null);
        }
        IntVal ops = new IntVal(0);
        String nodeId = req.getNodeId();
        // get and auth node being transfered
        log.debug("Transfer node: " + nodeId + " operation=" + req.getOperation());
        // we do allowAuth below, not here
        SubNode node = read.getNode(ms, nodeId, false, null);
        if (node == null) {
            throw new RuntimeEx("Node not found: " + nodeId);
        }
        // get user node of person being transfered to
        SubNode toUserNode = null;
        if (req.getOperation().equals(TransferOp.TRANSFER.s())) {
            toUserNode = read.getAccountByUserName(null, req.getToUser(), false);
            if (toUserNode == null) {
                throw new RuntimeEx("User not found: " + req.getToUser());
            }
        }
        // get account node of person doing the transfer
        SubNode fromUserNode = null;
        if (!StringUtils.isEmpty(req.getFromUser())) {
            fromUserNode = read.getAccountByUserName(null, req.getFromUser(), false);
            if (fromUserNode == null) {
                throw new RuntimeEx("User not found: " + req.getFromUser());
            }
        }
        transferNode(ms, req.getOperation(), node, fromUserNode, toUserNode, ops);
        if (req.isRecursive()) {
            // todo-2: make this ONLY query for the nodes that ARE owned by the person doing the transfer,
            // but leave as ALL node for the admin who might specify the 'from'?
            for (SubNode n : read.getSubGraph(ms, node, null, 0, false, true, null)) {
                transferNode(ms, req.getOperation(), n, fromUserNode, toUserNode, ops);
            }
        }
        if (ops.getVal() > 0) {
            arun.run(as -> {
                update.saveSession(as);
                return null;
            });
        }
        res.setMessage(String.valueOf(ops.getVal()) + " nodes were affected.");
        return res;
    }

    public void transferNode(MongoSession ms, String op, SubNode node, SubNode fromUserNode, SubNode toUserNode,
            IntVal ops) {
        if (node.getContent() != null && node.getContent().startsWith(Constant.ENC_TAG.s())) {
            // for now we silently ignore encrypted nodes during transfers. This needs some more thought
            // (todo-2)
            return;
        }
        /*
         * if we're transferring only from a specific user (will only be admin able to do this) then we
         * simply return without doing anything if this node in't owned by the person we're transferring
         * from
         */
        if (fromUserNode != null && !fromUserNode.getOwner().equals(node.getOwner())) {
            return;
        }

        if (op.equals(TransferOp.TRANSFER.s())) {
            // if we don't happen do own this node, do nothing.
            if (!ms.getUserNodeId().equals(node.getOwner())) {
                return;
            }
            SubNode ownerAccnt = (SubNode) arun.run(as -> read.getNode(as, node.getOwner()));
            ObjectId fromOwnerId = node.getOwner();
            node.setOwner(toUserNode.getOwner());
            node.setTransferFrom(fromOwnerId);
            // now we ensure that the original owner (before the transfer request) is shared to so they can
            // still see the node
            if (ownerAccnt != null) {
                acl.addPrivilege(ms, null, node, null, ownerAccnt,
                        Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
            }
            node.adminUpdate = true;
            ops.inc();
        } //
        else if (op.equals(TransferOp.ACCEPT.s())) { //
            // if we don't happen do own this node, do nothing.
            if (!ms.getUserNodeId().equals(node.getOwner())) {
                return;
            }
            if (node.getTransferFrom() != null) {
                // get user node of the person pointed to by the 'getTransferFrom' value to share back to them.
                SubNode frmUsrNode = (SubNode) arun.run(as -> read.getNode(as, node.getTransferFrom()));
                if (frmUsrNode != null) {
                    acl.addPrivilege(ms, null, node, null, frmUsrNode,
                            Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
                }
                node.setTransferFrom(null);
                node.adminUpdate = true;
                ops.inc();
            }
        } //
        else if (op.equals(TransferOp.REJECT.s())) { //
            // if we don't happen do own this node, do nothing.
            if (!ms.getUserNodeId().equals(node.getOwner())) {
                return;
            }
            if (node.getTransferFrom() != null) {
                // get user node of the person pointed to by the 'getTransferFrom' value to share back to them.
                SubNode frmUsrNode = (SubNode) arun.run(as -> read.getNode(as, node.getOwner()));
                node.setOwner(node.getTransferFrom());
                node.setTransferFrom(null);
                if (frmUsrNode != null) {
                    acl.addPrivilege(ms, null, node, null, frmUsrNode,
                            Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
                }
                node.adminUpdate = true;
                ops.inc();
            }
        } //
        else if (op.equals(TransferOp.RECLAIM.s())) { //
            if (node.getTransferFrom() != null) {
                // if we're reclaiming just make sure the transferFrom was us
                if (!ms.getUserNodeId().equals(node.getTransferFrom())) {
                    // skip nodes that don't apply
                    return;
                }
                SubNode frmUsrNode = (SubNode) arun.run(as -> read.getNode(as, node.getOwner()));
                node.setOwner(node.getTransferFrom());
                node.setTransferFrom(null);
                if (frmUsrNode != null) {
                    acl.addPrivilege(ms, null, node, null, frmUsrNode,
                            Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
                }
                node.adminUpdate = true;
                ops.inc();
            }
        }
    }
}
