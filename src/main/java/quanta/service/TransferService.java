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
import quanta.mongo.MongoTranMgr;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;
import quanta.rest.request.TransferNodeRequest;
import quanta.rest.response.TransferNodeResponse;
import quanta.util.TL;
import quanta.util.val.IntVal;

@Component
public class TransferService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(TransferService.class);

    public TransferNodeResponse transferNode(TransferNodeRequest req) {
        MongoTranMgr.ensureTran();
        TransferNodeResponse res = new TransferNodeResponse();
        // make sure only admin will be allowed to specify some arbitrary "fromUser"
        if (!TL.getSC().isAdmin()) {
            req.setFromUser(null);
        }
        IntVal ops = new IntVal(0);
        String nodeId = req.getNodeId();
        // get and auth node being transfered
        log.debug("Transfer node: " + nodeId + " operation=" + req.getOperation());
        // we check auth below, not here
        SubNode node = svc_mongoRead.getNodeAP(nodeId);
        if (node == null) {
            throw new RuntimeEx("Node not found: " + nodeId);
        }
        // get user node of person being transfered to
        AccountNode toUserNode = null;
        if (req.getOperation().equals(TransferOp.TRANSFER.s())) {
            toUserNode = svc_user.getAccountByUserNameAP(req.getToUser());
            if (toUserNode == null) {
                throw new RuntimeEx("User not found: " + req.getToUser());
            }
        }
        // get account node of person doing the transfer
        AccountNode fromUserNode = null;
        if (!StringUtils.isEmpty(req.getFromUser())) {
            fromUserNode = svc_user.getAccountByUserNameAP(req.getFromUser());
            if (fromUserNode == null) {
                throw new RuntimeEx("User not found: " + req.getFromUser());
            }
        }
        transferNode(req.getOperation(), node, fromUserNode, toUserNode, ops);
        if (req.isRecursive()) {
            for (SubNode n : svc_mongoRead.getSubGraph(node, null, 0, false, null)) {
                transferNode(req.getOperation(), n, fromUserNode, toUserNode, ops);

                // only cache up to 100 dirty nodes at time time before saving/flushing changes.
                if (TL.getDirtyNodeCount() > 100) {
                    svc_mongoUpdate.saveSession();
                }
            }
        }
        if (ops.getVal() > 0) {
            svc_arun.run(() -> {
                svc_mongoUpdate.saveSession();
                return null;
            });
        }
        res.setMessage(String.valueOf(ops.getVal()) + " nodes were affected.");
        return res;
    }

    public void transferNode(String op, SubNode node, SubNode fromUserNode, SubNode toUserNode,
            IntVal ops) {
        if (node.getContent() != null && node.getContent().startsWith(Constant.ENC_TAG.s())) {
            // for now we silently ignore encrypted nodes during transfers. This needs some more thought
            // (todo-2)
            return;
        }
        /*
         * if we're transferring only from a specific user (will only be admin able to do this) then we
         * simply return without doing anything if this node isn't owned by the person we're transferring
         * from
         */
        if (fromUserNode != null && !fromUserNode.getOwner().equals(node.getOwner())) {
            return;
        }

        if (op.equals(TransferOp.TRANSFER.s())) {
            // if we don't happen do own this node, do nothing.
            if (!TL.getSC().getUserNodeObjId().equals(node.getOwner())) {
                return;
            }
            AccountNode ownerAccnt = svc_user.getAccountNodeAP(node.getOwner());
            ObjectId fromOwnerId = node.getOwner();
            node.setOwner(toUserNode.getOwner());
            node.setTransferFrom(fromOwnerId);
            // now we ensure that the original owner (before the transfer request) is shared to so they can
            // still see the node
            if (ownerAccnt != null) {
                svc_acl.addPrivilege(null, node, null, ownerAccnt,
                        Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
            }
            ops.inc();
        } //
        else if (op.equals(TransferOp.ACCEPT.s())) { //
            // if we don't happen do own this node, do nothing.
            if (!TL.getSC().getUserNodeObjId().equals(node.getOwner())) {
                return;
            }
            if (node.getTransferFrom() != null) {
                // get user node of the person pointed to by the 'getTransferFrom' value to share back to them.
                AccountNode frmUsrNode = svc_user.getAccountNodeAP(node.getTransferFrom());
                if (frmUsrNode != null) {
                    svc_acl.addPrivilege(null, node, null, frmUsrNode,
                            Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
                }
                node.setTransferFrom(null);
                ops.inc();
            }
        } //
        else if (op.equals(TransferOp.REJECT.s())) { //
            // if we don't happen do own this node, do nothing.
            if (!TL.getSC().getUserNodeObjId().equals(node.getOwner())) {
                return;
            }
            if (node.getTransferFrom() != null) {
                // get user node of the person pointed to by the 'getTransferFrom' value to share back to them.
                AccountNode frmUsrNode = svc_user.getAccountNodeAP(node.getOwner());
                node.setOwner(node.getTransferFrom());
                node.setTransferFrom(null);
                if (frmUsrNode != null) {
                    svc_acl.addPrivilege(null, node, null, frmUsrNode,
                            Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
                }
                ops.inc();
            }
        } //
        else if (op.equals(TransferOp.RECLAIM.s())) { //
            if (node.getTransferFrom() != null) {
                // if we're reclaiming just make sure the transferFrom was us
                if (!TL.getSC().getUserNodeObjId().equals(node.getTransferFrom())) {
                    // skip nodes that don't apply
                    return;
                }
                AccountNode frmUsrNode = svc_user.getAccountNodeAP(node.getOwner());
                node.setOwner(node.getTransferFrom());
                node.setTransferFrom(null);
                if (frmUsrNode != null) {
                    svc_acl.addPrivilege(null, node, null, frmUsrNode,
                            Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
                }
                ops.inc();
            }
        }
        svc_mongoUpdate.saveAP(node);
    }
}
