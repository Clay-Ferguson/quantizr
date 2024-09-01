package quanta.mongo;

import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.exception.ForbiddenException;
import quanta.exception.base.RuntimeEx;
import quanta.model.AccessControlInfo;
import quanta.model.PrivilegeInfo;
import quanta.model.client.Attachment;
import quanta.model.client.Constant;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;
import quanta.util.Const;
import quanta.util.TL;
import quanta.util.XString;

/**
 * Service for checking authorization for access to nodes. Checks what users are accessing what
 * nodes and checks their privileges againts the ACL on the Nodes.
 */
@Component
public class MongoAuth extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(MongoAuth.class);
    private static final boolean verbose = false;
    private static final Object adminSessionLck = new Object();
    private static SessionContext adminSC;
    private static final ConcurrentHashMap<String, SubNode> userNodesById = new ConcurrentHashMap<>();

    public SessionContext getAdminSC() {
        if (adminSC != null) {
            return adminSC;
        }
        synchronized (adminSessionLck) {
            if (adminSC == null) {
                AccountNode root = svc_mongoRead.getDbRoot();
                adminSC = new SessionContext();
                adminSC.setUserName(PrincipalName.ADMIN.s());
                adminSC.setUserNodeId(root.getId().toHexString());
            }
            return adminSC;
        }
    }

    public String getAccountPropById(String accountId, String prop) {
        String val = null;
        // try to get the node from the cache of nodes
        SubNode accntNode = userNodesById.get(accountId);
        // if we found the node get property from it to return.
        if (accntNode != null) {
            val = accntNode.getStr(prop);
        }
        // else we have to lookup the node from the DB, and then cache it if found
        else {
            accntNode = svc_mongoRead.getNode(accountId);
            if (accntNode != null) {
                val = accntNode.getStr(prop);
                userNodesById.put(accountId, accntNode);
            }
        }
        return val;
    }

    /*
     * Returns a list of all user names that are shared to on this node, including "public" if any are
     * public.
     */
    public List<String> getUsersSharedTo(SubNode node) {
        List<String> userNames = null;
        List<AccessControlInfo> acList = getAclEntries(node);

        if (acList != null) {
            for (AccessControlInfo info : acList) {
                String userNodeId = info.getPrincipalNodeId();
                String name = null;
                if (PrincipalName.PUBLIC.s().equals(userNodeId)) {
                    name = PrincipalName.PUBLIC.s();
                } //
                else if (userNodeId != null) {
                    SubNode accountNode = svc_mongoRead.getNode(userNodeId);
                    if (accountNode != null) {
                        name = accountNode.getStr(NodeProp.USER);
                    }
                }
                if (name != null) {
                    // lazy create the list
                    if (userNames == null) {
                        userNames = new LinkedList<>();
                    }
                    userNames.add(name);
                }
            }
        }
        return userNames;
    }

    /*
     * When a child is created under a parent we want to default the sharing on the child so that
     * there's an explicit share to the owner of the parent (minus any share to 'child' user that may be
     * in the parent Acl, because that would represent 'child' node sharing to himself which is never
     * done)
     */
    public void setDefaultReplyAcl(SubNode parent, SubNode child) {
        // if parent or child is null or parent is an ACCOUNT node do nothing here.
        if (parent == null || parent.isType(NodeType.ACCOUNT) || child == null)
            return;
        // Special case of replying to (appending under) a FRIEND-type node is always to make this a
        // private message to the user that friend node represents
        if (parent.isType(NodeType.FRIEND)) {
            // get user prop from node
            String userName = parent.getStr(NodeProp.USER);
            // if we have a userProp, find the account node for the user
            if (userName != null) {
                AccountNode accountNode = svc_user.getAccountByUserNameAP(userName);
                if (accountNode != null) {
                    child.putAc(accountNode.getIdStr(), new AccessControl(null, Const.RDWR));
                }
            }
        }
        // otherwise if not a FRIEND node we just share to the owner of the parent node
        else {
            // add `parent.owner` to the ACL
            child.putAc(parent.getOwner().toHexString(), new AccessControl(null, Const.RDWR));
        }
    }

    public boolean isAllowedUserName(String userName) {
        userName = userName.trim();
        return (!userName.equalsIgnoreCase(PrincipalName.ADMIN.s())
                && !userName.equalsIgnoreCase(PrincipalName.PUBLIC.s()) && //
                !userName.equalsIgnoreCase(PrincipalName.ANON.s()));
    }

    public Criteria addReadSecurity(Criteria crit) {
        return addSecurity(false, crit, null);
    }

    public Criteria addWriteSecurity(Criteria crit) {
        return addSecurity(true, crit, null);
    }

    public Criteria addReadSecurity(Criteria crit, List<Criteria> ands) {
        return addSecurity(false, crit, ands);
    }

    /*
     * Filters to get only nodes that are public, are shared to the current user, or owned by current
     * user. For single node lookups we won't need this because we can do it the old way and be faster,
     * but for queries of multiple records (page rendering, timeline, search, etc.) we need to build
     * this security right into the query using this method.
     * 
     * Takes a `criteria` and optionally some `ands`, and returns a criteria object that is guaranteed
     * to include any or all of the ands as well as the security criteria.
     */
    public Criteria addSecurity(boolean write, Criteria crit, List<Criteria> ands) {
        // admin can bypass all security
        if (TL.hasAdminPrivileges()) {
            if (ands != null && ands.size() > 0) {
                return crit.andOperator(ands);
            } else {
                return crit;
            }
        }

        // If we didn't have admin privileges above, then we must have a session context
        if (TL.getSC() == null) {
            String msg = "ThreadLocals doesn't have SessionContext.";
            log.error(msg);
            throw new RuntimeException(msg);
        }

        SubNode myAcntNode = null;

        // if anonymous check for public nodes
        if (TL.getSC().isAnon()) {
            if (write) {
                throw new RuntimeException("Unable to build writable query by unknown session context");
            }

            // if we have no 'ands', just tack on to existing criteria
            if (ands == null) {
                // if unknown person the simple requirement is to be public
                return crit.and(SubNode.AC + "." + PrincipalName.PUBLIC.s()).ne(null);
            } else {
                ands.add(Criteria.where(SubNode.AC + "." + PrincipalName.PUBLIC.s()).ne(null));
                return crit.andOperator(ands);
            }
        } else {
            // if we have a person/account get their account node first
            myAcntNode = svc_mongoRead.getNode(TL.getSC().getUserNodeId());

            // if unknown person then again only a condition for public is what we want
            if (myAcntNode == null) {
                if (write) {
                    throw new RuntimeException("Unable to build writable query by unknown user");
                }

                // if we have no 'ands', just tack on to existing criterial
                if (ands == null) {
                    return crit.and(SubNode.AC + "." + PrincipalName.PUBLIC.s()).ne(null);
                } else {
                    ands.add(Criteria.where(SubNode.AC + "." + PrincipalName.PUBLIC.s()).ne(null));
                    return crit.andOperator(ands);
                }
            }
            // if we have a specific user consuming this data, set up conditions, for whatever they should be
            // able to see
            else {
                List<Criteria> ors = new LinkedList<>();

                // if not needing 'write' access then the criteria of "PUBLIC or Shared to Me" is added to OR set.
                if (!write) {
                    // node is public
                    ors.add(Criteria.where(SubNode.AC + "." + PrincipalName.PUBLIC.s()).ne(null));
                    // or node is shared to me
                    ors.add(Criteria.where(SubNode.AC + "." + myAcntNode.getOwner().toHexString()).ne(null));
                }
                // or node is OWNED by me
                ors.add(Criteria.where(SubNode.OWNER).is(myAcntNode.getOwner()));
                // or node was Transferred by me
                ors.add(Criteria.where(SubNode.XFR).is(myAcntNode.getOwner()));

                if (ands == null) {
                    ands = new LinkedList<Criteria>();
                }
                ands.add(new Criteria().orOperator(ors));
                return crit.andOperator(ands);
            }
        }
    }

    public void ownerAuth(SubNode node) {
        if (node == null) {
            throw new RuntimeEx("Auth Failed. Node did not exist.");
        }
        if (TL.hasAdminPrivileges()) {
            return;
        }
        if (TL.getSC() == null) {
            // when we get here it normally means we should've called "arun.exec" to manage
            // the thread instead of justs passing in an 'ms' or null
            throw new RuntimeException("ThreadLocals doesn't have session.");
        }
    
        if (TL.getSC().getUserNodeObjId() == null) {
            throw new RuntimeException("session has no userNode: " + XString.prettyPrint(TL.getSC()));
        }
        if (!TL.getSC().getUserNodeObjId().equals(node.getOwner())) {
            log.error("Unable to save Node (expected ownerId " + TL.getSC().getUserNodeObjId().toHexString() + "): "
                    + XString.prettyPrint(node));
            throw new ForbiddenException();
        }
    }

    public void requireAdmin() {
        if (!TL.hasAdminPrivileges())
            throw new RuntimeEx("auth fail");
    }

    public void writeAuth(SubNode node) {
        try {
            auth(node, PrivilegeType.WRITE);
        } catch (RuntimeException e) {
            log.debug("session: " + TL.getSC().getUserName() + " tried to write to nodeId " + node.getIdStr()
                    + " and was refused.");
            throw e;
        }
    }

    public void readAuth(SubNode node) {
        try {
            auth(node, PrivilegeType.READ);
        } catch (RuntimeException e) {
            log.debug("session: " + TL.getSC().getUserName() + " tried to read nodeId " + node.getIdStr()
                    + " and was refused.");
            throw e;
        }
    }

    public void auth(SubNode node, PrivilegeType... privs) {
        // during server init no auth is required.
        if (node == null || !MongoRepository.fullInit) {
            return;
        }

        if (verbose)
            log.trace("auth: " + node.getPath());
        if (TL.hasAdminPrivileges()) {
            if (verbose)
                log.trace("you are admin. auth success.");
            return; // admin can do anything. skip auth
        }
        auth(node, Arrays.asList(privs));
    }

    public boolean ownedByThreadUser(SubNode node) {
        return node != null && node.getOwner() != null
                && node.getOwner().toHexString().equals(TL.getSC().getUserNodeId());
    }

    public boolean ownedBy(SessionContext sc, SubNode node) {
        return node != null && node.getOwner() != null && node.getOwner().toHexString().equals(sc.getUserNodeId());
    }

    /*
     * The way know a node is an account node is that it is its id matches its' owner. Self owned node.
     * This is because the very definition of the 'owner' on any given node is the ID of the user's root
     * node of the user who owns it
     */
    public boolean isAnAccountNode(SubNode node) {
        return node.getIdStr().equals(node.getOwner().toHexString());
    }

    /* Returns true if this user on this session has privType access to 'node' */
    public void auth(SubNode node, List<PrivilegeType> priv) {
        // during server init no auth is required.
        if (node == null || !MongoRepository.fullInit) {
            return;
        }
        // admin has full power over all nodes
        if (TL.hasAdminPrivileges()) {
            if (verbose)
                log.trace("auth granted. you're admin.");
            return;
        }
        if (TL.getSC() == null) {
            throw new RuntimeEx("session context is null");
        }

        if (verbose)
            log.debug("auth path " + node.getPath() + " for " + TL.getSC().getUserName());

        if (node.getOwner() == null) {
            throw new RuntimeEx("node had no owner: " + node.getIdStr());
        }

        if (TL.getSC().getUserNodeObjId() != null) {
            // if this session user is the owner of this node, then they have full power
            if (TL.getSC().getUserNodeObjId().equals(node.getOwner())) {
                if (verbose)
                    log.trace("allow: user " + TL.getSC().getUserName() + " owns node. accountId: "
                            + node.getOwner().toHexString());
                return;
            }
            if (TL.getSC().getUserNodeObjId().equals(node.getTransferFrom())) {
                if (verbose)
                    log.trace("allow: user " + TL.getSC().getUserName() + " is transferring node. accountId: "
                            + node.getTransferFrom().toHexString());
                return;
            }
        }

        if (priv == null || priv.size() == 0) {
            throw new RuntimeEx("privileges not specified.");
        }

        String sessionUserNodeId =
                TL.getSC().getUserNodeObjId() != null ? TL.getSC().getUserNodeObjId().toHexString() : null;
        if (nodeAuth(node, sessionUserNodeId, priv)) {
            if (verbose)
                log.trace("nodeAuth success");
            return;
        }
        throw new ForbiddenException();
    }

    /*
     * NOTE: It is the normal flow that we expect sessionUserNodeId to be null for any anonymous
     * requests and this is fine because we are basically going to only be pulling 'public' acl to
     * check, and this is by design.
     */
    public boolean nodeAuth(SubNode node, String sessionUserNodeId, List<PrivilegeType> privs) {
        HashMap<String, AccessControl> acl = node.getAc();
        if (acl == null) {
            return false;
        }
        String allPrivs = "";
        AccessControl ac = (sessionUserNodeId == null ? null : acl.get(sessionUserNodeId));
        String privsForUserId = ac != null ? ac.getPrvs() : null;
        if (privsForUserId != null) {
            allPrivs += privsForUserId;
        }
        // We always add on any privileges assigned to the PUBLIC when checking privs for this user,
        // because the auth equivalent is really the union of this set.
        AccessControl acPublic = acl.get(PrincipalName.PUBLIC.s());
        String privsForPublic = acPublic != null ? acPublic.getPrvs() : null;
        if (privsForPublic != null) {
            if (allPrivs.length() > 0) {
                allPrivs += ",";
            }
            allPrivs += privsForPublic;
        }
        if (allPrivs.length() > 0) {
            for (PrivilegeType priv : privs) {
                if (allPrivs.indexOf(priv.name) == -1) {
                    // if any priv is missing we fail the auth
                    return false;
                }
            }
            // if we looped thru all privs ok, auth is successful
            return true;
        }
        return false;
    }

    public List<AccessControlInfo> getAclEntries(SubNode node) {
        HashMap<String, AccessControl> aclMap = node.getAc();
        if (aclMap == null) {
            return null;
        }
        // I'd like this to not be created unless needed but that pesky lambda below needs a 'final' thing
        // to work with.
        List<AccessControlInfo> ret = new LinkedList<>();
        aclMap.forEach((k, v) -> {
            AccessControlInfo acei = createAccessControlInfo(k, v.getPrvs());
            if (acei != null) {
                ret.add(acei);
            }
        });
        return ret.size() == 0 ? null : ret;
    }

    public AccessControlInfo createAccessControlInfo(String principalId, String authType) {
        String displayName = null;
        String principalName = null;
        String publicKey = null;
        String avatarVer = null;

        // If this is a share to public we don't need to lookup a user name
        if (principalId.equalsIgnoreCase(PrincipalName.PUBLIC.s())) {
            principalName = PrincipalName.PUBLIC.s();
        }
        // else we need the user name
        else {
            SubNode principalNode = svc_mongoRead.getNodeAP(principalId);
            if (principalNode == null) {
                return null;
            }
            principalName = principalNode.getStr(NodeProp.USER);
            displayName = principalNode.getStr(NodeProp.DISPLAY_NAME);
            publicKey = principalNode.getStr(NodeProp.USER_PREF_PUBLIC_KEY);
            Attachment att = principalNode.getAttachment(Constant.ATTACHMENT_PRIMARY.s(), false, false);
            avatarVer = att != null ? att.getBin() : null;
        }
        AccessControlInfo info = new AccessControlInfo(displayName, principalName, principalId, publicKey, avatarVer);
        info.addPrivilege(new PrivilegeInfo(authType));
        return info;
    }

    /*
     * Finds all subnodes that have a share targeting the sharedToAny (account node IDs of a person
     * being shared with), regardless of the type of share 'rd,rw'. To find public shares pass 'public'
     * in sharedTo instead
     */
    public Iterable<SubNode> searchSubGraphByAclUser(String pathToSearch, List<String> sharedToAny, Sort sort,
            int limit, ObjectId ownerIdMatch) {
        Query q = subGraphByAclUser_query(pathToSearch, sharedToAny, ownerIdMatch);
        if (q == null)
            return null;
        if (sort != null) {
            q.with(sort);
        }
        q.limit(limit);
        return svc_ops.find(q);
    }

    /*
     * counts all subnodes that have a share targeting the sharedTo (account node ID of a person being
     * shared with), regardless of the type of share 'rd,rw'. To find public shares pass 'public' in
     * sharedTo instead
     */
    public long countSubGraphByAclUser(String pathToSearch, List<String> sharedToAny, ObjectId ownerIdMatch) {
        Query q = subGraphByAclUser_query(pathToSearch, sharedToAny, ownerIdMatch);
        if (q == null)
            return 0L;
        return svc_ops.count(q);
    }

    private Query subGraphByAclUser_query(String pathToSearch, List<String> sharedToAny, ObjectId ownerIdMatch) {
        // this will be node.getPath() to search under the node, or null for searching
        // under all user content.
        if (pathToSearch == null) {
            pathToSearch = NodePath.USERS_PATH;
        }
        List<Criteria> ands = new LinkedList<Criteria>();
        Query q = new Query();
        Criteria crit = svc_mongoUtil.subGraphCriteria(pathToSearch);
        if (sharedToAny != null && sharedToAny.size() > 0) {
            List<Criteria> orCriteria = new LinkedList<>();

            for (String share : sharedToAny) {
                orCriteria.add(Criteria.where(SubNode.AC + "." + share).ne(null));
            }
            ands.add(new Criteria().orOperator(orCriteria));
        }
        if (ownerIdMatch != null) {
            ands.add(Criteria.where(SubNode.OWNER).is(ownerIdMatch));
        }
        crit = svc_auth.addReadSecurity(crit, ands);
        q.addCriteria(crit);
        return q;
    }

    /*
     * Finds nodes that have any sharing on them at all. This query is secure and can't leak any
     * incorrect nodes to wrong users because ownerIdMatch forces only the owner running the query to
     * see their own nodes only
     */
    public Iterable<SubNode> searchSubGraphByAcl(int skip, String pathToSearch, ObjectId ownerIdMatch, Sort sort,
            int limit) {
        Query q = subGraphByAcl_query(pathToSearch, ownerIdMatch);
        if (sort != null) {
            q.with(sort);
        }
        if (skip > 0) {
            q.skip(skip);
        }
        q.limit(limit);
        return svc_ops.find(q);
    }

    /* Finds nodes that have any sharing on them at all */
    public long countSubGraphByAcl(String pathToSearch, ObjectId ownerIdMatch) {
        Query q = subGraphByAcl_query(pathToSearch, ownerIdMatch);
        return svc_ops.count(q);
    }

    public Query subGraphByAcl_query(String pathToSearch, ObjectId ownerIdMatch) {
        List<Criteria> ands = new LinkedList<Criteria>();
        Query q = new Query();
        if (pathToSearch == null) {
            pathToSearch = NodePath.USERS_PATH;
        }
        /*
         * This regex finds all that START WITH path, have some characters after path, before the end of the
         * string. Without the trailing (.+)$ we would be including the node itself in addition to all its
         * children.
         */
        Criteria crit = svc_mongoUtil.subGraphCriteria(pathToSearch);

        ands.add(Criteria.where(SubNode.AC).ne(null));
        if (ownerIdMatch != null) {
            ands.add(Criteria.where(SubNode.OWNER).is(ownerIdMatch));
        }
        crit = svc_auth.addReadSecurity(crit, ands);
        q.addCriteria(crit);
        return q;
    }

    public void asUser(String userName) {
        AccountNode userNode = svc_user.getAccountByUserNameAP(userName);
        if (userNode == null) {
            throw new RuntimeException("UserNode not found for userName " + userName);
        }

        SessionContext sc = new SessionContext();
        sc.setUserName(userName);
        sc.setUserNodeId(userNode.getIdStr());
        TL.setSC(sc);
    }
}
