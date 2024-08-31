package quanta.service;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.StringTokenizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.BulkOperations.BulkMode;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;
import jakarta.servlet.http.HttpServletResponse;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.exception.ForbiddenException;
import quanta.exception.base.RuntimeEx;
import quanta.model.AccessControlInfo;
import quanta.model.PrivilegeInfo;
import quanta.model.client.NodeProp;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.MongoPrincipal;
import quanta.mongo.MongoTranMgr;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;
import quanta.rest.request.AddPrivilegeRequest;
import quanta.rest.request.CopySharingRequest;
import quanta.rest.request.GetNodePrivilegesRequest;
import quanta.rest.request.RemovePrivilegeRequest;
import quanta.rest.request.SetCipherKeyRequest;
import quanta.rest.request.SetUnpublishedRequest;
import quanta.rest.response.AddPrivilegeResponse;
import quanta.rest.response.CopySharingResponse;
import quanta.rest.response.CreateSubNodeResponse;
import quanta.rest.response.GetNodePrivilegesResponse;
import quanta.rest.response.RemovePrivilegeResponse;
import quanta.rest.response.SetCipherKeyResponse;
import quanta.rest.response.SetUnpublishedResponse;
import quanta.rest.response.base.ResponseBase;
import quanta.util.Const;
import quanta.util.TL;
import quanta.util.XString;

/**
 * Service methods for (ACL): processing security, privileges, and Access Control List information
 * on nodes.
 */
@Component
public class AclService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(AclService.class);

    /**
     * Returns the privileges that exist on the node identified in the request.
     */
    public GetNodePrivilegesResponse cm_getNodePrivileges(GetNodePrivilegesRequest req) {
        GetNodePrivilegesResponse res = new GetNodePrivilegesResponse();
        String nodeId = req.getNodeId();
        SubNode node = svc_mongoRead.getNode(nodeId);
        res.setAclEntries(svc_auth.getAclEntries(node));
        return res;
    }

    public CopySharingResponse copySharing(CopySharingRequest req) {
        MongoTranMgr.ensureTran();
        CopySharingResponse res = new CopySharingResponse();
        SubNode node = svc_mongoRead.getNode(req.getNodeId());
        BulkOperations bops = null;
        /*
         * todo-2: It seems like maybe batching can't update a collection property? so for now I'm disabling
         * batch mode which makes this code work.
         */
        boolean batchMode = false;
        Boolean unpublished = node.getBool(NodeProp.UNPUBLISHED);
        int batchSize = 0;

        for (SubNode n : svc_mongoRead.getSubGraph(node, null, 0, false, null)) {
            if (batchMode) {
                // lazy instantiate
                if (bops == null) {
                    bops = svc_ops.bulkOps(BulkMode.UNORDERED);
                }
                try {
                    svc_auth.ownerAuth(n);
                    n.set(NodeProp.UNPUBLISHED, unpublished ? unpublished : null);
                    Criteria crit = new Criteria("id").is(n.getId());
                    crit = svc_auth.addReadSecurity(crit);

                    Query query = new Query().addCriteria(crit);
                    Update update = new Update().set(SubNode.AC, node.getAc()).set(SubNode.PROPS, n.getProps());
                    bops.updateOne(query, update);
                    if (++batchSize > Const.MAX_BULK_OPS) {
                        bops.execute();
                        batchSize = 0;
                        bops = null;
                    }
                } catch (Exception e) {
                    // ignore
                }
            } else {
                svc_auth.ownerAuth(n);
                n.set(NodeProp.UNPUBLISHED, unpublished ? unpublished : null);
                log.debug("Set Unpublished on node " + n.getIdStr() + " to " + unpublished);
                n.setAc(node.getAc());
            }
        }
        if (batchMode && bops != null) {
            bops.execute();
        } else {
            svc_mongoUpdate.saveSession();
        }
        return res;
    }

    /*
     * Adds or updates a new privilege to a node
     */
    public AddPrivilegeResponse addPrivilege(AddPrivilegeRequest req) {
        MongoTranMgr.ensureTran();
        AddPrivilegeResponse res = new AddPrivilegeResponse();
        String nodeId = req.getNodeId();
        SubNode node = svc_mongoRead.getNode(nodeId);
        svc_auth.ownerAuth(node);
        boolean success = true;

        for (String principal : req.getPrincipals()) {
            principal = XString.stripIfStartsWith(principal, "@");
            if (!addPrivilege(null, node, principal, null, req.getPrivileges(), res)) {
                success = false;
            }
        }
        res.setCode(success ? 200 : HttpServletResponse.SC_EXPECTATION_FAILED);
        return res;
    }

    /*
     * Adds or updates a new privilege to a node
     */
    public SetUnpublishedResponse setUnpublished(SetUnpublishedRequest req) {
        MongoTranMgr.ensureTran();
        SetUnpublishedResponse res = new SetUnpublishedResponse();
        String nodeId = req.getNodeId();
        SubNode node = svc_mongoRead.getNode(nodeId);
        svc_auth.ownerAuth(node);
        node.set(NodeProp.UNPUBLISHED, req.isUnpublished() ? true : null);
        return res;
    }

    /*
     * Adds or updates a new encryption key to a node
     */
    public SetCipherKeyResponse cm_setCipherKey(SetCipherKeyRequest req) {
        SetCipherKeyResponse res = new SetCipherKeyResponse();
        String nodeId = req.getNodeId();
        SubNode node = svc_mongoRead.getNode(nodeId);
        svc_auth.ownerAuth(node);
        String cipherKey = node.getStr(NodeProp.ENC_KEY);
        if (cipherKey == null) {
            throw new RuntimeEx("Attempted to alter keys on a non-encrypted node.");
        }
        boolean success = setCipherKey(node, req.getPrincipalNodeId(), req.getCipherKey(), res);
        res.setCode(success ? 200 : HttpServletResponse.SC_EXPECTATION_FAILED);
        return res;
    }

    public boolean setCipherKey(SubNode node, String principalNodeId, String cipherKey, SetCipherKeyResponse res) {
        boolean ret = false;
        HashMap<String, AccessControl> acl = node.getAc();
        AccessControl ac = acl.get(principalNodeId);
        if (ac != null) {
            ac.setKey(cipherKey);
            node.setAc(acl);
            svc_mongoUpdate.save(node);
            ret = true;
        }
        return ret;
    }

    /**
     * Adds the privileges to the node sharing this node to principal, which will be either a userName
     * or 'public' (when the node is being shared to public)
     *
     * If BulkOperations is non-null we use it instead of a non-bulk operation.
     */
    public boolean addPrivilege(BulkOperations bops, SubNode node, String principal, AccountNode principalNode,
            List<String> privileges, AddPrivilegeResponse res) {
        if ((principal == null && principalNode == null) || node == null)
            return false;
        if (principal != null) {
            principal = principal.trim();
        }
        String cipherKey = node.getStr(NodeProp.ENC_KEY);
        String mapKey = null;

        // If we are sharing to public, then that's the map key
        if (PrincipalName.PUBLIC.s().equalsIgnoreCase(principal)) {
            if (cipherKey != null) {
                throw new RuntimeEx("Cannot make an encrypted node public.");
            }
            mapKey = PrincipalName.PUBLIC.s();
        }
        // otherwise we're sharing to a person so we now get their userNodeId to use as map key
        else {
            // if no principal node passed in, then look it up
            if (principalNode == null) {
                String _principal = principal;
                principalNode = svc_user.getAccountByUserNameAP(_principal);
                if (principalNode == null) {
                    if (res != null) {
                        res.error("Unknown user name: " + principal);
                    }
                    return false;
                }
            } else {
                principal = principalNode.getStr(NodeProp.USER);
            }
            mapKey = principalNode.getIdStr();
            /*
             * If this node is encrypted we get the public key of the user being shared with to send back to the
             * client, which will then use it to encrypt the symmetric key to the data, and then send back up to
             * the server to store in this sharing entry
             */
            if (cipherKey != null) {
                String principalPubKey = principalNode.getStr(NodeProp.USER_PREF_PUBLIC_KEY);
                if (principalPubKey == null) {
                    if (res != null) {
                        res.error("User doesn't have a PublicKey available: " + principal);
                        return false;
                    }
                }
                if (res != null) {
                    res.setPrincipalPublicKey(principalPubKey);
                    res.setPrincipalNodeId(mapKey);
                }
            }
        }

        HashMap<String, AccessControl> acl = node.getAc();
        // initialize acl to a map if it's null, or if we're sharing to public
        if (acl == null) {
            acl = new HashMap<>();
        }
        // Get access control entry from map, but if one is not found, we can just create one.
        AccessControl ac = acl.get(mapKey);
        if (ac == null) {
            ac = new AccessControl();
        }
        String prvs = "";
        boolean authAdded = false;

        // Scan all the privileges to be added to this principal (rd, rw, etc)
        for (String priv : privileges) {
            // If this privilege is not already on ac.prvs string then append it
            if (prvs.indexOf(priv) == -1) {
                authAdded = true;
                if (prvs.length() > 0) {
                    prvs += ",";
                }
                prvs += priv;
            }
        }

        if (authAdded) {
            ac.setPrvs(prvs);
            acl.put(mapKey, ac);
            node.setAc(acl);
        }
        return true;
    }

    // isMine
    public boolean userOwnsNode(SubNode node) {
        boolean isMine = TL.getSC().getUserNodeObjId().equals(node.getOwner());
        return isMine;
    }

    public void removeAclEntry(SubNode node, String principalNodeId, String privToRemove) {
        // special syntax is we remove all if asterisk specified
        if (principalNodeId.equals("*")) {
            node.setAc(null);
            svc_mongoUpdate.save(node);
            return;
        }
        HashMap<String, AccessControl> acl = node.getAc();
        if (acl == null)
            return;
        String newPrivs = "";
        boolean removed = false;
        AccessControl ac = null;

        // if removing all privileges
        if ("*".equals(privToRemove)) {
            removed = true;
        }
        // else removing just some specific privileges
        else {
            ac = acl.get(principalNodeId);
            if (ac == null) {
                log.debug("ac not found for " + principalNodeId + "\nACL DUMP: " + XString.prettyPrint(acl));
                return;
            }
            String privs = ac.getPrvs();
            if (privs == null) {
                log.debug("privs not found for " + principalNodeId + "\nACL DUMP: " + XString.prettyPrint(acl));
                return;
            }
            HashSet<String> setToRemove = XString.tokenizeToSet(privToRemove, ",", true);
            StringTokenizer t = new StringTokenizer(privs, ",", false);

            // build the new comma-delimited privs list by adding all that aren't in the setToRemove
            while (t.hasMoreTokens()) {
                String tok = t.nextToken().trim();
                if (setToRemove.contains(tok)) {
                    removed = true;
                    continue;
                }
                if (newPrivs.length() > 0) {
                    newPrivs += ",";
                }
                newPrivs += tok;
            }
        }

        if (removed) {
            // If there are no privileges left for this principal, then remove the principal entry completely
            // from the ACL. We don't store empty ones.
            if (newPrivs.equals("")) {
                acl.remove(principalNodeId);
            } else {
                ac.setPrvs(newPrivs);
                acl.put(principalNodeId, ac);
            }

            // if there are now no acls at all left set the ACL to null, so it is completely removed from the
            // node
            if (acl.isEmpty()) {
                node.setAc(null);
            } else {
                node.setAc(acl);
            }
            svc_mongoUpdate.save(node);
        }
    }

    /*
     * Removes the privilege specified in the request from the node specified in the request
     */
    public RemovePrivilegeResponse removePrivilege(RemovePrivilegeRequest req) {
        MongoTranMgr.ensureTran();
        RemovePrivilegeResponse res = new RemovePrivilegeResponse();
        String nodeId = req.getNodeId();
        SubNode node = svc_mongoRead.getNode(nodeId);
        svc_auth.ownerAuth(node);
        removeAclEntry(node, req.getPrincipalNodeId(), req.getPrivilege());
        // if there are no privileges left remove the "unpublished" flag, because there's no need for it.
        if (node.getAc() == null || node.getAc().size() == 0) {
            node.set(NodeProp.UNPUBLISHED, null);
        }
        return res;
    }

    public List<String> getOwnerNames(SubNode node) {
        Set<String> ownerSet = new HashSet<>();
        // We walk up the tree util we get to the root, or find ownership on node, or any of it's parents
        int sanityCheck = 0;

        while (++sanityCheck < 100) {
            List<MongoPrincipal> principals = getNodePrincipals(node);

            for (MongoPrincipal p : principals) {
                /*
                 * todo-3: this is a spot that can be optimized. We should be able to send just the userNodeId back
                 * to client, and the client should be able to deal with that (i think). depends on how much
                 * ownership info we need to show user. ownerSet.add(p.getUserNodeId());
                 */
                AccountNode userNode = svc_user.getAccountNode(p.getUserNodeId());
                String userName = userNode.getStr(NodeProp.USER);
                ownerSet.add(userName);
            }
            if (principals.size() == 0) {
                node = svc_mongoRead.getParent(node);
                if (node == null)
                    break;
            } else {
                break;
            }
        }
        List<String> ownerList = new LinkedList<>(ownerSet);
        Collections.sort(ownerList);
        return ownerList;
    }

    public static List<MongoPrincipal> getNodePrincipals(SubNode node) {
        List<MongoPrincipal> principals = new LinkedList<>();
        MongoPrincipal principal = new MongoPrincipal();
        principal.setUserNodeId(node.getId());
        principal.setAccessLevel("w");
        principals.add(principal);
        return principals;
    }

    public static boolean isPublic(SubNode node) {
        return node != null && node.getAc() != null && node.getAc().containsKey(PrincipalName.PUBLIC.s());
    }

    public static boolean isWritable(SubNode node) {
        return node != null && node.getAc() != null && node.getAc().containsKey(PrincipalName.PUBLIC.s())
                && node.getAc().get(PrincipalName.PUBLIC.s()).getPrvs().contains(PrivilegeType.WRITE.s());
    }

    // The effeciency of using this function is it won't set the node to dirty of nothing changed.
    public void setKeylessPriv(SubNode node, String key, String prvs) {
        // if no privileges exist at all just add the one we need to add
        if (node.getAc() == null) {
            node.putAc(key, new AccessControl(null, prvs));
        }
        // otherwise first check to see if it's already added
        else {
            AccessControl ac = node.getAc().get(key);
            if (ac != null && ac.getPrvs().equals(prvs)) {
            }
            // else need to add it.
            else {
                node.putAc(key, new AccessControl(null, prvs));
            }
        }
    }

    public void failIfAdminOwned(SubNode node) {
        if (isAdminOwned(node)) {
            throw new ForbiddenException();
        }
    }

    public boolean isAdminOwned(SubNode node) {
        if (node == null)
            return false;
        return node.getOwner().equals(svc_auth.getAdminSC().getUserNodeObjId());
    }

    /**
     * Sets the default reply ACL on the child node to be the same as the parent node. This is used when
     * creating a new node, and we want to inherit the parent's ACL.
     */
    public void inheritSharingFromParent(ResponseBase res, SubNode parentNode, SubNode childNode) {
        // we always determine the access controls from the parent for any new nodes
        svc_auth.setDefaultReplyAcl(parentNode, childNode);

        if (AclService.isPublic(parentNode)) {
            List<String> prvList = AclService.isWritable(parentNode) ? //
                    Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s())
                    : Arrays.asList(PrivilegeType.READ.s());
            svc_acl.addPrivilege(null, childNode, PrincipalName.PUBLIC.s(), null, prvList, null);
        }

        // inherit UNPUBLISHED prop from parent, if we own the parent
        if (parentNode.getBool(NodeProp.UNPUBLISHED) && parentNode.getOwner().equals(TL.getSC().getUserNodeObjId())) {
            childNode.set(NodeProp.UNPUBLISHED, true);
        }

        String cipherKey = parentNode.getStr(NodeProp.ENC_KEY);
        if (cipherKey != null) {
            if (res instanceof CreateSubNodeResponse _res) {
                _res.setEncrypt(true);
            }
        }
    }

    /**
     * Builds a list of AccessControlInfo objects from the ACL on the node. This is used when returning
     * ACL information to the client.
     */
    public List<AccessControlInfo> buildAccessControlList(SessionContext sc, SubNode node) {
        List<AccessControlInfo> ret = null;
        HashMap<String, AccessControl> ac = node.getAc();
        if (ac == null)
            return null;

        for (Map.Entry<String, AccessControl> entry : ac.entrySet()) {
            String principalId = entry.getKey();
            AccessControl acval = entry.getValue();
            // lazy create list
            if (ret == null) {
                ret = new LinkedList<>();
            }
            AccessControlInfo acInfo = convertToAcInfo(sc, node, principalId, acval);
            ret.add(acInfo);
        }
        return ret;
    }

    public AccessControlInfo convertToAcInfo(SessionContext sc, SubNode node, String principalId, AccessControl ac) {
        AccessControlInfo acInfo = new AccessControlInfo();
        acInfo.setPrincipalNodeId(principalId);
        if (ac.getPrvs() != null && ac.getPrvs().contains(PrivilegeType.READ.s())) {
            acInfo.addPrivilege(new PrivilegeInfo(PrivilegeType.READ.s()));
        }
        if (ac.getPrvs() != null && ac.getPrvs().contains(PrivilegeType.WRITE.s())) {
            acInfo.addPrivilege(new PrivilegeInfo(PrivilegeType.WRITE.s()));
        }
        if (principalId != null) {
            if (PrincipalName.PUBLIC.s().equals(principalId)) {
                acInfo.setPrincipalName(PrincipalName.PUBLIC.s());
                acInfo.setDisplayName(PrincipalName.PUBLIC.s());
            } else {
                svc_arun.run(() -> {
                    acInfo.setPrincipalName(svc_auth.getAccountPropById(principalId, NodeProp.USER.s()));
                    acInfo.setDisplayName(svc_auth.getAccountPropById(principalId, NodeProp.DISPLAY_NAME.s()));
                    return null;
                });
            }
        }
        return acInfo;
    }
}
