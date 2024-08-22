package quanta.mongo;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.TextCriteria;
import org.springframework.stereotype.Component;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.TreeNode;
import quanta.model.client.NodeLink;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.mongo.model.CreateNodeLocation;
import quanta.mongo.model.SubNode;
import quanta.util.DateUtil;
import quanta.util.TL;
import quanta.util.Util;
import quanta.util.XString;
import quanta.util.val.Val;

/**
 * Performs the 'create' (as in CRUD) operations for creating new nodes in MongoDB
 * 
 * There are many more opportunities in this class to use the ThreadLocals.nodeCache to store
 * information in the thread for use during context of one call
 */
@Component
public class MongoRead extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(MongoRead.class);
    private static final Object rootLock = new Object();
    private SubNode dbRoot;
    private static int MAX_TREE_GRAPH_SIZE = 100000;

    // we call this during app init so we don't need to have thread safety here the rest of the time.
    public SubNode getDbRoot() {
        synchronized (rootLock) {
            if (dbRoot == null) {
                dbRoot = findNodeByPathAP(NodePath.ROOT_PATH);
            }
            return dbRoot;
        }
    }

    public SubNode setDbRoot(SubNode node) {
        synchronized (rootLock) {
            dbRoot = node;
            return dbRoot;
        }
    }

    /**
     * Gets account name from the root node associated with whoever owns 'node'
     */
    public String getNodeOwner(SubNode node) {
        if (node.getOwner() == null) {
            throw new RuntimeEx("Node has null owner: " + XString.prettyPrint(node));
        }
        SubNode userNode = getNode(node.getOwner());
        return userNode.getStr(NodeProp.USER);
    }

    // Used this for troubleshooting a constraint violation on one of the partial indexes
    public void dumpByPropertyMatch(String prop, String val) {
        log.debug("Dump for: prop " + prop + "=" + val);
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PROPS + "." + prop).is(val);
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        Iterable<SubNode> iter = svc_ops.find(q);

        for (SubNode node : iter) {
            log.debug("NODE: " + XString.prettyPrint(node));
        }
    }

    public String getParentPath(SubNode node) {
        return XString.truncAfterLast(node.getPath(), "/");
    }

    /*
     * returns true only if node path is KNOWN (by hasChildren at least), not to have any children.
     *
     * Beware: A false return tells us NOTHING. No gained knowledge.
     */
    public boolean noChildren(SubNode node) {
        if (SubNode.USE_HAS_CHILDREN && node != null && node.getHasChildren() != null
                && !node.getHasChildren().booleanValue()) {
            return true;
        }
        return false;
    }

    /*
     * returns true only if node path is KNOWN (by hasChildren at least), not to have any children.
     *
     * Beware: A false return tells us NOTHING. No gained knowledge.
     */
    public boolean noChildren(String path) {
        if (SubNode.USE_HAS_CHILDREN) {
            SubNode node = getNodeAP(path);
            // using booleanValue for clarity
            if (node != null && node.getHasChildren() != null && !node.getHasChildren().booleanValue()) {
                return true;
            }
        }
        return false;
    }

    public long getChildCount(String path) {
        // statistically I think it pays off to always try the faster way and then assume worst case is that
        // we might have warmed up the MongoDb for what the following query will need.
        if (noChildren(path))
            return 0;
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexChildren(path));
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        return svc_ops.count(q);
    }

    public long getChildCountRecursive(String path) {
        // statistically I think it pays off to always try the faster way and then assume worst case is that
        // we might have warmed up the MongoDb for what the following query will need.
        if (noChildren(path))
            return 0;
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexSubGraph(path));
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        return svc_ops.count(q);
    }

    public boolean hasChildren(SubNode node) {
        // if the node knows it's children status (non-null value) return that.
        if (SubNode.USE_HAS_CHILDREN && node.getHasChildren() != null) {
            // calling booleanValue for clarity
            return node.getHasChildren().booleanValue();
        }
        boolean ret = directChildrenExist(node.getPath());
        node.setHasChildren(ret);
        return ret;
    }

    public void forceCheckHasChildren(SubNode node) {
        boolean ret = directChildrenExist(node.getPath());
        node.setHasChildren(ret);
    }

    public boolean directChildrenExist(String path) {
        // WARNING: Leave this as a note to NOT call this optimization here. It is definitely
        // counter-productive.
        // if (noChildren(ms, path)) return false;
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexChildren(path));
        q.addCriteria(crit);
        return svc_ops.exists(q);
    }

    /*
     * This is used mainly during a delete request to verify the user is deleting what they think
     * they're deleting Specifically a rogue case where they don't think there are children under a
     * node, because the GUI looks that way for some pathalogocial case and they attemp to delete. This
     * method will throw an exception if anythig about the child state of 'node' seems off.
     */
    public void hasChildrenConsistencyCheck(SubNode node) {
        Boolean hasChildren = node.getHasChildren();
        boolean childrenFound = svc_mongoRead.directChildrenExist(node.getPath());

        // detect inconsistency
        if (childrenFound && (hasChildren != null && !hasChildren.booleanValue())) {

            // repair inconsistency
            node.setHasChildren(true);
            svc_mongoUpdate.saveSession();

            // terminate user operation
            throw new RuntimeException("One or more nodes were in an invalid state.");
        }
    }

    public long getNodeCount() {
        Query q = new Query();
        return svc_ops.count(q);
    }

    /* If this 'path' is known to exist and never needs to be validated, return true */
    public boolean knownPath(String path) {
        // if this is a path we KNOW exists, return false
        if (path == null || path.length() == 0 || !path.contains("/") || path.equals(NodePath.PENDING_PATH)
                || path.equals(NodePath.ROOT_PATH) || path.equals(NodePath.USERS_PATH)) {
            return true;
        }
        return false;
    }

    /* Checks ALL parent paths to make sure they all exist. Returns true if some parent doesn't exist */
    public boolean isOrphan(String path) {
        int sanityCheck = 0;
        // if this is a path we KNOW exists, return false
        if (knownPath(path))
            return false;

        while (sanityCheck++ < 1000) {
            // get parent path
            path = XString.truncAfterLast(path, "/");
            if (knownPath(path))
                return false;
            // if the parent path does not exist, we're done. Path passed in is an orphan.
            if (!pathExists(path)) {
                return true;
            }
        }
        // If we get here this is definitely a bug.
        throw new RuntimeException("isOrphan algo failure.");
    }

    /*
     * Throws an exception if the parent Node of 'path' does not exist.
     */
    public void checkParentExists(String path) {
        boolean isRootPath = svc_mongoUtil.isRootPath(path);
        if (isRootPath)
            return;
        String parPath = XString.truncAfterLast(path, "/");

        // ignore any paths we don't need to check
        if (parPath == null || parPath.equals("") || parPath.equals("/") || parPath.equals(NodePath.ROOT_PATH)
                || parPath.equals(NodePath.PENDING_PATH) || parPath.equals(NodePath.PENDING_PATH_S))
            return;

        if (parPath.startsWith(NodePath.PENDING_PATH_S)) {
            parPath = parPath.replace(NodePath.PENDING_PATH_S, NodePath.ROOT_PATH_S);
        }
        // no need to check root.
        if (parPath.equals(NodePath.ROOT_PATH) || parPath.equals(NodePath.ROOT_PATH_S)) {
            return;
        }
        // no need to check USERS
        if (parPath.equals(NodePath.USERS_PATH) || parPath.equals(NodePath.USERS_PATH_S)) {
            return;
        }
        if (!pathExists(parPath)) {
            throw new RuntimeEx("Attempted to add a node before its parent exists:" + parPath);
        }
    }

    public SubNode getNodeByName(String name) {
        return getNodeByName(name, null);
    }

    public SubNode getNodeByNameAP(String name, Val<SubNode> accntNode) {
        return svc_arun.run(() -> getNodeByName(name, accntNode));
    }

    /*
     * The name can have either of two different formats:
     *
     * 1) "nodeName" (admin owned node)
     *
     * 2) "userName:nodeName" (a named node some user has created)
     */
    public SubNode getNodeByName(String name, Val<SubNode> accntNode) {
        Query q = new Query();
        if (name == null)
            return null;
        // we tolerate a prefix at the FRONT of either format 1, or 2, and ignore it.
        name = XString.stripIfStartsWith(name, ":");
        ObjectId nodeOwnerId;
        int colonIdx = -1;
        SubNode userNode = null;
        // if 'name' doesn't contain a colon it's known to be just an admin-owned global named node
        // without a user prefix
        if ((colonIdx = name.indexOf(":")) == -1) {
            nodeOwnerId = getDbRoot().getOwner();
        }
        // If there is a colon in the name then it's of the format 'userName:nodeName'
        else {
            String userName = name.substring(0, colonIdx);
            // pass a null session here to cause adminSession to be used which is required to get a user node,
            // but it always safe to get this node this way here.
            userNode = svc_user.getAccountByUserNameAP(userName);
            if (userNode == null) {
                log.debug("Unable to find node by: " + name);
                return null;
            }
            // set output parameter if we have one
            if (accntNode != null) {
                accntNode.setVal(userNode);
            }
            nodeOwnerId = userNode.getOwner();
            name = name.substring(colonIdx + 1);
        }

        Criteria crit = Criteria.where(SubNode.NAME).is(name).and(SubNode.OWNER).is(nodeOwnerId);
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        return svc_ops.findOne(q);
    }

    public SubNode getNode(String identifier) {
        return getNode(identifier, null);
    }

    public SubNode getNodeAP(String identifier) {
        return svc_arun.run(() -> getNode(identifier, null));
    }

    // AP == Admin Priviledged
    public SubNode getNodeAP(String identifier, Val<SubNode> accntNode) {
        return svc_arun.run(() -> getNode(identifier, accntNode));
    }

    /**
     * Gets a node using any of the 5 naming types:
     *
     * <pre>
     * 1) ID (hex string, no special prefix)
     * 2) path (starts with slash),
     * 3) global name (name of admin owned node, starts with colon, and only contains one colon)
     * 4) name of user owned node formatted as (":userName:nodeName")
     * 5) name of an admin-owned node formatted as ":nodeName"
     * 6) access node by type '~typeName' (admin account) or '~userName~typeName' (user account)
     * </pre>
     */
    public SubNode getNode(String identifier, Val<SubNode> accntNode) {
        if (identifier == null)
            return null;
        if (identifier.equals("/")) {
            throw new RuntimeEx(
                    "SubNode doesn't implement the root node. Root is implicit and never needs an actual node to represent it.");
        }
        SubNode ret = null;
        if (identifier.startsWith("~")) {
            identifier = identifier.substring(1);
            int tileIdx = identifier.indexOf("~");

            // if there is both a userName and a typeName in the identifier
            if (tileIdx != -1) {
                String userName = identifier.substring(0, tileIdx);
                String typeName = identifier.substring(tileIdx + 1);
                ret = getUserNodeByType(userName, null, null, typeName, null, false);
            }
            // else just a simple identifier
            else {
                String typeName = identifier;
                ret = getUserNodeByType(TL.getSC().getUserName(), null, null, typeName, null, false);
            }
        }
        // Node name lookups are done by prefixing the search with a colon (:)
        else if (identifier.startsWith(":")) {
            ret = getNodeByName(identifier.substring(1), accntNode);
        }
        // else if search starts with a slash then it's a path
        else if (identifier.startsWith("/")) {
            ret = findNodeByPath(identifier);
        }
        // else the identifier is a node id
        else {
            if (ret == null) {
                ret = svc_ops.findById(new ObjectId(identifier));
            }
        }
        return ret;
    }

    public SubNode getNode(ObjectId objId) {
        return svc_ops.findById(objId);
    }

    public SubNode findNodeByPathAP(String path) {
        return svc_arun.run(() -> findNodeByPath(path));
    }

    public SubNode findNodeByPath(String path) {
        path = XString.stripIfEndsWith(path, "/");
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).is(path);
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        return svc_ops.findOne(q);
    }

    public boolean pathExists(String path) {
        path = XString.stripIfEndsWith(path, "/");
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).is(path);
        q.addCriteria(crit);
        return svc_ops.exists(q);
    }

    public boolean nodeExists(ObjectId id) {
        Query q = new Query();
        q.addCriteria(Criteria.where(SubNode.ID).is(id));
        return svc_ops.exists(q);
    }

    public SubNode getOwnerAP(SubNode node) {
        return svc_arun.run(() -> getOwner(node));
    }

    public SubNode getOwner(SubNode node) {
        if (node == null)
            return null;
        return svc_ops.findById(node.getOwner());
    }

    public SubNode getParentAP(SubNode node) {
        return svc_arun.run(() -> getParent(node));
    }

    public SubNode getParent(SubNode node) {
        if (node == null)
            return null;

        return getParentByPath(node.getPath());
    }

    /*
     * WARNING: This always converts a 'pending' path to a non-pending one (/r/p/ v.s. /r/)
     */
    public SubNode getParentByPath(String path) {
        if ("/".equals(path)) {
            return null;
        }
        String parentPath = XString.truncAfterLast(path, "/");
        if (StringUtils.isEmpty(parentPath))
            return null;

        // If node is in pending area take the pending part out of the path to get the real parent
        parentPath = parentPath.replace(NodePath.PENDING_PATH_S, NodePath.ROOT_PATH_S);
        return getNode(parentPath);
    }

    public List<String> getChildrenIds(SubNode node, boolean ordered, Integer limit) {
        if (noChildren(node)) {
            return Collections.<String>emptyList();
        }
        svc_auth.readAuth(node);
        Query q = new Query();
        if (limit != null) {
            q.limit(limit.intValue());
        }
        // This regex finds all that START WITH "path/" and then end with some other string that does NOT
        // contain "/", so that we know it's not at a deeper level of the tree, but is immediate children
        // of 'node'
        //
        // ^:aa:bb:([^:])*$
        //
        // example: To find all DIRECT children (non-recursive) under path /aa/bb regex is
        // ^\/aa\/bb\/([^\/])*$ (Note that in the java string the \ becomes \\ below...)
        Criteria crit =
                Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexChildren(node == null ? "" : node.getPath()));
        if (ordered) {
            q.with(Sort.by(Sort.Direction.ASC, SubNode.ORDINAL));
        }
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        Iterable<SubNode> iter = svc_ops.find(q);
        List<String> nodeIds = new LinkedList<>();

        for (SubNode n : iter) {
            nodeIds.add(n.getIdStr());
        }
        return nodeIds;
    }

    /*
     * If node is null it's path is considered empty string, and it represents the 'root' of the tree.
     * There is no actual NODE that is root node.
     */
    public Iterable<SubNode> getChildren(String path, Sort sort, Integer limit, int skip, TextCriteria textCriteria,
            Criteria moreCriteria, boolean preCheck) {
        if (preCheck && noChildren(path)) {
            return Collections.<SubNode>emptyList();
        }
        Query q = new Query();
        if (limit != null && limit.intValue() > 0) {
            q.limit(limit.intValue());
        }
        if (skip > 0) {
            q.skip(skip);
        }
        // This regex finds all that START WITH "path/" and then end with some other string that does NOT
        // contain "/", so that we know it's not at a deeper level of the tree, but is immediate children
        // of 'node'
        //
        // ^:aa:bb:([^:])*$
        //
        // example: To find all DIRECT children (non-recursive) under path /aa/bb regex is
        // ^\/aa\/bb\/([^\/])*$ (Note that in the java string the \ becomes \\ below...)
        Criteria crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexChildren(path));
        if (textCriteria != null) {
            q.addCriteria(textCriteria);
        }
        if (moreCriteria != null) {
            q.addCriteria(moreCriteria);
        }
        if (sort != null) {
            q.with(sort);
        }
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        return svc_ops.find(q);
    }

    public Iterable<SubNode> getChildrenAP(SubNode node, Sort sort, Integer limit, int skip) {
        return svc_arun.run(() -> getChildren(node, sort, limit, skip, null));
    }

    public Iterable<SubNode> getChildren(SubNode node, Sort sort, Integer limit, int skip) {
        return getChildren(node, sort, limit, skip, null);
    }

    public Iterable<SubNode> getChildrenAP(SubNode node, Sort sort, Integer limit, int skip, Criteria moreCriteria) {
        return svc_arun.run(() -> getChildren(node, sort, limit, skip, moreCriteria));
    }

    /*
     * If node is null it's path is considered empty string, and it represents the 'root' of the tree.
     * There is no actual NODE that is root node
     */
    public Iterable<SubNode> getChildren(SubNode node, Sort sort, Integer limit, int skip, Criteria moreCriteria) {
        svc_auth.readAuth(node);
        return getChildren(node.getPath(), sort, limit, skip, null, moreCriteria, false);
    }

    /*
     * All we need to do here is query for children an do a "max(ordinal)" operation on that, but
     * digging the information off the web for how to do this appears to be something that may take a
     * few hours so i'm skipping it for now and just doing an inverse sort on ORDER and pulling off the
     * top one and using that for my MAX operation. AFAIK this might even be the most efficient
     * approach. Who knows.
     */
    public Long getMaxChildOrdinal(SubNode node) {
        if (noChildren(node))
            return 0L;
        svc_auth.readAuth(node);
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexChildren(node.getPath()));
        q.with(Sort.by(Sort.Direction.DESC, SubNode.ORDINAL));
        q.addCriteria(crit);
        q.limit(1);
        SubNode nodeFound = svc_ops.findOne(q);
        if (nodeFound == null) {
            return 0L;
        }
        return nodeFound.getOrdinal();
    }

    public Long getMinChildOrdinal(SubNode node) {
        if (noChildren(node))
            return 0L;
        svc_auth.readAuth(node);
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexChildren(node.getPath()));
        q.with(Sort.by(Sort.Direction.ASC, SubNode.ORDINAL));
        q.addCriteria(crit);
        q.limit(1);
        SubNode nodeFound = svc_ops.findOne(q);
        if (nodeFound == null) {
            return 0L;
        }
        return nodeFound.getOrdinal();
    }

    // if 'parent' of 'node' is known it should be passed in, or else null passed in, and parent will be
    // looked up instead
    public SubNode getSiblingAbove(SubNode node, SubNode parent) {
        if (parent == null) {
            parent = getParent(node);
        }
        if (parent == null || noChildren(parent))
            return null;
        svc_auth.readAuth(node);
        if (node.getOrdinal() == null) {
            node.setOrdinal(0L);
        }
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexChildren(node.getParentPath()));
        q.with(Sort.by(Sort.Direction.DESC, SubNode.ORDINAL));
        q.addCriteria(crit);

        // leave this example. you can do a RANGE like this.
        // query.addCriteria(Criteria.where(SubNode.FIELD_ORDINAL).lt(50).gt(20));
        q.addCriteria(Criteria.where(SubNode.ORDINAL).lt(node.getOrdinal()));
        q.limit(1);
        return svc_ops.findOne(q);
    }

    // if 'parent' of 'node' is known it should be passed in, or else null passed in, and parent will be
    // looked up instead
    public SubNode getSiblingBelow(SubNode node, SubNode parent) {
        if (parent == null) {
            parent = getParent(node);
        }
        if (parent == null || noChildren(parent))
            return null;
        svc_auth.readAuth(node);
        if (node.getOrdinal() == null) {
            node.setOrdinal(0L);
        }

        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexChildren(node.getParentPath()));
        q.with(Sort.by(Sort.Direction.ASC, SubNode.ORDINAL));
        q.addCriteria(crit);

        // leave this example. you can do a RANGE like this.
        // query.addCriteria(Criteria.where(SubNode.FIELD_ORDINAL).lt(50).gt(20));
        q.addCriteria(Criteria.where(SubNode.ORDINAL).gt(node.getOrdinal()));
        q.limit(1);
        return svc_ops.findOne(q);
    }

    public Iterable<SubNode> getSubGraphAP(SubNode node, Sort sort, int limit, boolean publicOnly,
            Criteria moreCriteria) {
        return svc_arun.run(() -> getSubGraph(node, sort, limit, publicOnly, moreCriteria));
    }

    /*
     * Gets (recursively) all nodes under 'node', by using all paths starting with the path of that node
     */
    public Iterable<SubNode> getSubGraph(SubNode node, Sort sort, int limit, boolean publicOnly,
            Criteria moreCriteria) {
        if (noChildren(node)) {
            return Collections.<SubNode>emptyList();
        }

        Query q = new Query();
        /*
         * This regex finds all that START WITH path, have some characters after path, before the end of the
         * string. Without the trailing (.+)$ we would be including the node itself in addition to all its
         * children.
         */
        Criteria crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexSubGraph(node.getPath()));
        if (publicOnly) {
            crit = crit.and(SubNode.AC + "." + PrincipalName.PUBLIC.s()).ne(null);
        }

        // Note if publicOnly we don't need any more security conditions. Anyone can see 'public stuff'
        if (!publicOnly) {
            crit = svc_auth.addReadSecurity(crit);
        }
        q.addCriteria(crit);

        if (moreCriteria != null) {
            q.addCriteria(moreCriteria);
        }
        if (sort != null) {
            q.with(sort);
        }
        if (limit > 0) {
            q.limit(limit);
        }
        return svc_ops.find(q);
    }

    /**
     * prop is optional and if non-null means we should search only that one field.
     *
     * timeRangeType: futureOnly, pastOnly, pastDue, all
     */
    public Iterable<SubNode> searchSubGraph(SubNode node, String prop, String text, String sortField, String sortDir,
            int limit, int skip, boolean fuzzy, boolean caseSensitive, String timeRangeType, boolean recursive,
            boolean requirePriority, boolean requireAttachment, boolean requireDate) {
        if (noChildren(node)) {
            return Collections.<SubNode>emptyList();
        }
        svc_auth.readAuth(node);
        List<Criteria> ands = new LinkedList<>();
        TextCriteria textCriteria = null;
        Sort sort = null;
        /*
         * This regex finds all that START WITH path, have some characters after path, before the end of the
         * string. Without the trailing (.+)$ we would be including the node itself in addition to all its
         * children.
         */
        Criteria crit = null;
        if (recursive) {
            crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexSubGraph(node.getPath()));
        } else {
            crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexChildren(node.getPath()));
        }

        ands.add(crit);

        if (!StringUtils.isEmpty(text)) {
            if (StringUtils.isEmpty(prop)) {
                prop = SubNode.CONTENT;
            }

            if (fuzzy) {
                ands.add(Criteria.where(prop).regex(text, caseSensitive ? "" : "i"));
            } else {
                List<String> quotedStrings = XString.extractQuotedStrings(text, "or");
                if (!quotedStrings.isEmpty()) {
                    List<Criteria> orCriteria = new ArrayList<>();
                    for (String quotedString : quotedStrings) {
                        orCriteria.add(Criteria.where(prop).regex(quotedString, caseSensitive ? "" : "i"));
                    }
                    ands.add(new Criteria().orOperator(orCriteria.toArray(new Criteria[0])));
                } else {
                    /*
                     * Check if use has entered "and" between quoted strings, because this is a valid syntax but we send
                     * it to mongo without the "ands", because they're not needed, they are assumed.
                     */
                    quotedStrings = XString.extractQuotedStrings(text, "and");
                    if (!quotedStrings.isEmpty()) {
                        text = "";
                        for (String quotedString : quotedStrings) {
                            if (text.length() > 0) {
                                text += " ";
                            }
                            text += "\"" + quotedString + "\"";
                        }
                    }
                    textCriteria = TextCriteria.forDefaultLanguage();
                    textCriteria.matching(text);
                    textCriteria.caseSensitive(caseSensitive);
                }
            }
        }

        if (requirePriority) {
            ands.add(Criteria.where(SubNode.PROPS + ".priority").gt("0"));
        }
        if (requireAttachment) {
            ands.add(Criteria.where(SubNode.ATTACHMENTS).ne(null));
        }
        if (requireDate) {
            ands.add(Criteria.where(SubNode.PROPS + "." + NodeProp.DATE).ne(null));
        }

        if (!StringUtils.isEmpty(sortField)) {
            if ((SubNode.PROPS + ".date").equals(sortField) && timeRangeType != null) {
                sortDir = "DESC";
                // example date RANGE condition:
                // query.addCriteria(Criteria.where("startDate").gte(startDate).lt(endDate));
                // and this 'may' be the same:
                // Query q = new Query(Criteria.where("ip").is(ip)
                // .andOperator(Criteria.where("createdDate").lt(endDate),
                // Criteria.where("createdDate").gte(startDate)));
                if ("futureOnly".equals(timeRangeType)) {
                    // because we want to show the soonest items on top, for "future" query, we have
                    // to sort in order (not rev-chron)
                    sortDir = "ASC";
                    ands.add(Criteria.where(sortField).gt(new Date().getTime()));
                } //
                else if ("today".equals(timeRangeType)) {
                    ands.add(Criteria.where(sortField).gte(DateUtil.getStartOfToday()));
                    ands.add(Criteria.where(sortField).lt(DateUtil.getEndOfToday()));
                } //
                else if ("pastOnly".equals(timeRangeType)) { //
                    ands.add(Criteria.where(sortField).lt(new Date().getTime()));
                } //
                else if ("pastDue".equals(timeRangeType)) { //
                    ands.add(Criteria.where(sortField).lt(new Date().getTime()));
                    ands.add(Criteria.where(SubNode.TAGS).regex("#due", "i"));
                }
                // prop on the node // if showing all dates the condition here is that there at least IS a 'date'
                else if ("all".equals(timeRangeType)) {
                    ands.add(Criteria.where(sortField).ne(null));
                }
            }
            if (!StringUtils.isEmpty(sortField)) {
                if ("contentLength".equals(sortField) || "treeDepth".equals(sortField)) {
                    sortDir = "ASC";
                }
                sort = Sort.by((sortDir != null && sortDir.equalsIgnoreCase("DESC")) ? Sort.Direction.DESC
                        : Sort.Direction.ASC, sortField);

                // if we're sorting by priority, we want to sort by priority first, and then by date. We include
                // date so that when
                // many have the same priority their sort order is still deterministic and unique
                if (sortField.equals(NodeProp.PRIORITY_FULL.s())) {
                    sort = sort.and(Sort.by(Sort.Direction.DESC, SubNode.CREATE_TIME));
                }
            }
        }

        /*
         * We support the special case of "contentLength" as sort order string, which is not a "real"
         * property, but a calculated one.
         *
         * For a calculated field we do an Aggregate Query operation. The purpose of this entire Aggregation
         * is to calculate contentLength on the fly so we can sort on it.
         */
        if ("contentLength".equals(sortField)) {
            return queryByConentLenOrder(limit, skip, ands, textCriteria, sort);
        } //
        else if ("treeDepth".equals(sortField)) {
            return queryByTreeDepthOrder(limit, skip, ands, textCriteria, sort);
        } //
        else {
            return basicQuery(limit, skip, ands, textCriteria, sort);
        }
    }

    private Iterable<SubNode> basicQuery(int limit, int skip, List<Criteria> ands, TextCriteria textCriteria,
            Sort sort) {
        Query q = new Query();
        Criteria c = svc_auth.addReadSecurity(new Criteria(), ands);
        q.addCriteria(c);

        if (textCriteria != null) {
            q.addCriteria(textCriteria);
        }
        if (sort != null) {
            q.with(sort);
        }
        if (limit > 0) {
            q.limit(limit);
        }
        if (skip > 0) {
            q.skip(skip);
        }
        return svc_ops.find(q);
    }

    private Iterable<SubNode> queryByTreeDepthOrder(int limit, int skip, List<Criteria> ands, TextCriteria textCriteria,
            Sort sort) {
        List<AggregationOperation> aggOps = new LinkedList<>();
        // MongoDB requires any TextCriteria (full-text search) to be the first op in the pipeline so we
        // process it first here
        if (textCriteria != null) {
            aggOps.add(Aggregation.match(textCriteria));
        }

        Criteria c = svc_auth.addReadSecurity(new Criteria(), ands);
        aggOps.add(Aggregation.match(c));

        aggOps.add(Aggregation.project().andInclude(SubNode.ALL_FIELDS).andExpression("size(split(pth, '/'))")
                .as("treeDepth"));

        // IMPORTANT: Having 'sort' before 'skip' and 'limit' is REQUIRED to get correct behavior, because
        // with aggregates we doing a step by step pipeline of processing so we need records in the
        // correct order before we do limit or skip and so the ordering of these 'ops' does that.
        aggOps.add(Aggregation.sort(sort));
        aggOps.add(Aggregation.skip((long) skip));
        aggOps.add(Aggregation.limit(limit));

        Aggregation agg = Aggregation.newAggregation(aggOps);
        AggregationResults<SubNode> results = svc_ops.aggregate(agg);
        return results.getMappedResults();
    }

    private Iterable<SubNode> queryByConentLenOrder(int limit, int skip, List<Criteria> ands, TextCriteria textCriteria,
            Sort sort) {
        List<AggregationOperation> aggOps = new LinkedList<>();
        // MongoDB requires any TextCriteria (full-text search) to be the first op in the pipeline so we
        // process it first here
        if (textCriteria != null) {
            aggOps.add(Aggregation.match(textCriteria));
        }

        Criteria c = svc_auth.addReadSecurity(new Criteria(), ands);
        aggOps.add(Aggregation.match(c));

        // calculate contentLength
        aggOps.add(Aggregation.project().andInclude(SubNode.ALL_FIELDS).andExpression("strLenCP(cont)")
                .as("contentLength"));
        // IMPORTANT: Having 'sort' before 'skip' and 'limit' is REQUIRED to get correct behavior, because
        // with aggregates we doing a step by step pipeline of processing so we need records in the
        // correct order before we do limit or skip and so the ordering of these 'ops' does that.
        aggOps.add(Aggregation.sort(sort));
        aggOps.add(Aggregation.skip((long) skip));
        aggOps.add(Aggregation.limit(limit));

        Aggregation agg = Aggregation.newAggregation(aggOps);
        AggregationResults<SubNode> results = svc_ops.aggregate(agg);
        return results.getMappedResults();
    }

    // todo-2: can these methods be moved into an RDF specific service
    public Iterable<SubNode> getLinkedNodes(String nodeId, String search) {
        SubNode node = getNode(nodeId);

        List<ObjectId> nodeIds = new LinkedList<>();
        List<NodeLink> links = node.getLinks();
        for (NodeLink lnk : links) {
            if (lnk.getName().equals(search)) {
                nodeIds.add(new ObjectId(lnk.getNodeId()));
            }
        }

        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.ID).in(nodeIds);
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        q.with(Sort.by(Sort.Direction.DESC, SubNode.MODIFY_TIME));
        return svc_ops.find(q);
    }

    public Iterable<SubNode> getRdfSubjects(String nodeId) {
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.LINKS).elemMatch(Criteria.where(NodeLink.ID).is(nodeId));
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        q.with(Sort.by(Sort.Direction.DESC, SubNode.MODIFY_TIME));
        return svc_ops.find(q);
    }

    /**
     * Special purpose query to get all nodes that have a "date" property.
     */
    public Iterable<SubNode> getCalendar(SubNode node) {
        if (noChildren(node)) {
            return Collections.<SubNode>emptyList();
        }
        svc_auth.readAuth(node);
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexSubGraph(node.getPath()));
        // this mod time condition is simply to be sure the user has 'saved' the node and not pick up new
        // node currently being crafted
        crit = crit.and(SubNode.MODIFY_TIME).ne(null);
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        q.addCriteria(Criteria.where(SubNode.PROPS + "." + NodeProp.DATE).ne(null));
        return svc_ops.find(q);
    }

    /*
     * todo-2: This is very low hanging fruit to make this a feature on the Search menu. In other words
     * implementing an "All Named Nodes" search would be trivial with this.
     */
    public Iterable<SubNode> getNamedNodes(SubNode node) {
        if (noChildren(node)) {
            return Collections.<SubNode>emptyList();
        }
        svc_auth.readAuth(node);
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexSubGraph(node.getPath()));
        crit = crit.and(SubNode.NAME).ne(null);
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        return svc_ops.find(q);
    }

    /*
     * Accepts either the 'userName' or the 'userNode' for the user. It's best to pass userNode if you
     * have it, to avoid a DB query.
     */
    public SubNode getUserNodeByType(String userName, SubNode userNode, String content, String type,
            List<String> publicPrivs, boolean autoCreate) {
        if (userNode == null) {
            if (userName == null) {
                userName = TL.getSC().getUserName();
            }
            userNode = svc_user.getAccountByUserNameAP(userName);
        }
        if (userNode == null) {
            log.warn("userNode not found for user name: " + userName);
            return null;
        }

        SubNode node = findSubNodeByType(userNode, type);
        if (node == null && autoCreate) {
            node = svc_mongoCreate.createNode(userNode, null, type, 0L, CreateNodeLocation.LAST, null, null, true, true,
                    null);
            node.setOwner(userNode.getId());
            node.setContent(content);
            node.touch();
            if (publicPrivs != null) {
                svc_acl.addPrivilege(null, node, PrincipalName.PUBLIC.s(), null, publicPrivs, null);
            }
            svc_mongoUpdate.save(node);
        }
        return node;
    }

    public SubNode getUserNodeByPropAP(String propName, String propVal, boolean caseSensitive) {
        return svc_arun.run(() -> getUserNodeByProp(propName, propVal, caseSensitive));
    }

    public SubNode getUserNodeByProp(String propName, String propVal, boolean caseSensitive) {
        if (StringUtils.isEmpty(propVal))
            return null;
        // Otherwise for ordinary users root is based off their username
        Query q = new Query();
        Criteria crit;
        if (caseSensitive) {
            crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexChildren(NodePath.USERS_PATH))
                    .and(SubNode.PROPS + "." + propName).is(propVal);
        } else {
            crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexChildren(NodePath.USERS_PATH))
                    .and(SubNode.PROPS + "." + propName).regex("^" + Pattern.quote(propVal) + "$", "i");
        }

        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        return svc_ops.findOne(q);
    }

    /*
     * Finds and returns the first node matching userName and type as direct child of 'node', or null if
     * not existing. Caller can pass userNode if its available, or else userName will be used to look it
     * up
     */
    public SubNode findNodeByUserAndType(SubNode node, SubNode userNode, String userName, String type) {
        if (userNode == null) {
            userNode = svc_user.getAccountByUserNameAP(userName);
            if (userNode == null) {
                return null;
            }
        }
        // Otherwise for ordinary users root is based off their username
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexChildren(node.getPath()))//
                .and(SubNode.TYPE).is(type)//
                .and(SubNode.PROPS + "." + NodeProp.USER_NODE_ID.s()).is(userNode.getIdStr());
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        SubNode ret = svc_ops.findOne(q);
        return ret;
    }

    /*
     * Finds the first node matching 'type' under 'path' (non-recursively, direct children only)
     */
    public SubNode findSubNodeByType(SubNode node, String type) {
        if (noChildren(node)) {
            return null;
        }
        // Other wise for ordinary users root is based off their username
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexChildren(node.getPath()))//
                .and(SubNode.TYPE).is(type);
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        return svc_ops.findOne(q);
    }

    /*
     * Finds nodes matching 'type' under 'path' (recursively)
     */
    public Iterable<SubNode> findSubNodesByType(SubNode node, String type, boolean recursive, Sort sort,
            Integer limit) {
        if (noChildren(node)) {
            return Collections.<SubNode>emptyList();
        }
        Query q = typedNodesUnderPath_query(node, type, recursive, sort, limit);
        return svc_ops.find(q);
    }

    /*
     * Counts nodes matching 'type' under 'path' (recursively)
     */
    public long countTypedNodesUnderPath(SubNode node, String type, Sort sort, Integer limit) {
        if (noChildren(node)) {
            return 0L;
        }
        Query q = typedNodesUnderPath_query(node, type, true, sort, limit);
        return svc_ops.count(q);
    }

    public Query typedNodesUnderPath_query(SubNode node, String type, boolean recursive, Sort sort, Integer limit) {
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(
                recursive ? svc_mongoUtil.regexSubGraph(node.getPath()) : svc_mongoUtil.regexChildren(node.getPath()))
                .and(SubNode.TYPE).is(type);
        if (sort != null) {
            q.with(sort);
        }
        if (limit != null) {
            q.limit(limit);
        }
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        return q;
    }

    /*
     * Returns one (or first) node contained directly under path (non-recursively) that has a matching
     * propName and propVal
     */
    public SubNode findNodeByProp(SubNode node, String propName, String propVal) {
        if (noChildren(node)) {
            return null;
        }
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexChildren(node.getPath())) //
                .and(SubNode.PROPS + "." + propName).is(propVal);
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        SubNode ret = svc_ops.findOne(q);
        svc_auth.readAuth(ret);
        return ret;
    }

    /*
     * Same as findSubNodeByProp but returns multiples. Finda ALL nodes contained directly under path
     * (non-recursively) that has a matching propName and propVal
     */
    public Iterable<SubNode> findNodesByProp(String path, String propName, String propVal) {
        if (noChildren(path)) {
            return Collections.<SubNode>emptyList();
        }
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexChildren(path)) //
                .and(SubNode.PROPS + "." + propName).is(propVal);
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        return svc_ops.find(q);
    }

    /*
     * Returns one (or first) node that has a matching propName and propVal
     */
    public SubNode findNodeByProp(String propName, String propVal) {
        if (propVal == null) {
            return null;
        }
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PROPS + "." + propName).is(propVal);
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        SubNode ret = svc_ops.findOne(q);
        svc_auth.readAuth(ret);
        return ret;
    }

    // Starts at 'leafId' node and goes up the tree to build a linear chain of nodes parent by parent
    // until get get to root of what this user can access or else the first "noexport" node.
    public TreeNode getThreadGraphTree(String leafId) {
        SubNode curNode = getNode(leafId);
        TreeNode curTreeNode = new TreeNode(curNode);

        while (true) {
            try {
                SubNode parentNode = getParent(curNode);
                if (parentNode == null || parentNode.getPath().equals(NodePath.ROOT_PATH) || parentNode.getType().equals(NodeType.ACCOUNT.s())
                        || parentNode.getStr(NodeProp.NO_EXPORT) != null) {
                    break;
                }

                TreeNode parentTreeNode = new TreeNode(parentNode);
                curTreeNode.parent = parentTreeNode;
                parentTreeNode.children = new LinkedList<>();
                parentTreeNode.children.add(curTreeNode);
                curTreeNode = parentTreeNode;
                curNode = parentNode;
            } catch (Exception e) {
                break;
            }
        }
        return curTreeNode;
    }

    // If optional idMap is passed in non-null it gets loaded with a map from nodeId to TreeNode
    public TreeNode getSubGraphTree(String rootId, Criteria criteria, HashMap<String, TreeNode> idMap) {
        SubNode rootNode = getNode(new ObjectId(rootId));
        if (rootNode == null)
            throw new RuntimeException("unable to access node: " + rootId);

        TreeNode rootTreeNode = new TreeNode(rootNode);
        if (idMap != null) {
            idMap.put(rootNode.getIdStr(), rootTreeNode);
        }

        // maps from path to node
        HashMap<String, TreeNode> nodeMap = new HashMap<>();
        nodeMap.put(rootNode.getPath(), rootTreeNode);

        // first scan to build up the nodes list and nodeMap
        for (SubNode n : getSubGraph(rootNode, null, 0, false, criteria)) {
            nodeMap.put(n.getPath(), new TreeNode(n));
            if (nodeMap.size() > MAX_TREE_GRAPH_SIZE) {
                throw new RuntimeException(
                        "Too much data to return. Max is " + String.valueOf(MAX_TREE_GRAPH_SIZE) + " nodes.");
            }
        }

        // process all nodes to add to children (as unordered children at first) to each node they go under
        nodeMap.forEach((k, n) -> {
            if (idMap != null) {
                idMap.put(n.node.getIdStr(), n);
            }
            TreeNode parent = nodeMap.get(n.node.getParentPath());

            // since root node is not in 'nodes' we know it's a failure if we find one whose parent
            // we don't know
            if (parent == null) {
                log.debug("Ignoring Orphan: " + n.node.getPath());
                // skip iteration element (warning: not returning from this function!)
                return;
            }
            if (parent.children == null) {
                parent.children = new LinkedList<>();
            }
            parent.children.add(n);
            if (n.parent == null) {
                n.parent = parent;
            }
        });

        nodeMap.forEach((k, n) -> {
            if (n.children != null) {
                n.children.sort((a, b) -> a.node.getOrdinal().compareTo(b.node.getOrdinal()));
            }
        });
        return rootTreeNode;
    }

    public List<SubNode> getFlatSubGraph(final String rootId, boolean includeComments) {
        LinkedList<SubNode> doc = new LinkedList<>();

        Criteria typeCriteria = null;
        if (!includeComments) {
            typeCriteria = Criteria.where(SubNode.TYPE).ne(NodeType.COMMENT);
        }

        TreeNode rootTreeNode = getSubGraphTree(rootId, typeCriteria, null);
        traverseTree(rootTreeNode, doc);
        return doc;
    }

    void traverseTree(TreeNode tn, LinkedList<SubNode> doc) {
        doc.add(tn.node);

        if (tn.children == null) {
            return;
        }
        tn.children.sort((a, b) -> a.node.getOrdinal().compareTo(b.node.getOrdinal()));

        for (TreeNode tni : tn.children) {
            traverseTree(tni, doc);

            // help garbage collector
            tn.children = null;
        }
    }

    // Generates the logicalOrdinal of node by counting all the nodes that have a 'lower ordinal' than
    // it does. If no nodes are lower in ordinal that makes it the top one, and thus 0th ordinal, etc.
    public long generateLogicalOrdinal(SubNode node) {
        Query q = new Query();
        Criteria crit = Criteria //
                .where(SubNode.PATH).regex(svc_mongoUtil.regexChildren(node.getParentPath())).and(SubNode.ORDINAL)
                .lt(node.getOrdinal());
        q.addCriteria(crit);
        return svc_ops.count(q);
    }
}
