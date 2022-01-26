package quanta.mongo;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.Arrays;
import java.util.Date;
import java.util.LinkedList;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.CriteriaDefinition;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.TextCriteria;
import org.springframework.stereotype.Component;
import quanta.config.AppProp;
import quanta.config.NodeName;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.instrument.PerfMon;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.model.SubNode;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import quanta.util.XString;

/**
 * Performs the 'create' (as in CRUD) operations for creating new nodes in MongoDB
 * <p>
 * There are many more opportunities in this class to use the ThreadLocals.nodeCache to store
 * information in the thread for use during context of one call
 */
@Component
public class MongoRead extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(MongoRead.class);

    @Autowired
    private AppProp prop;

    private static final Object dbRootLock = new Object();
    private SubNode dbRoot;

    // we call this during app init so we don't need to have thread safety here the rest of the time.
    public SubNode getDbRoot() {
        synchronized (dbRootLock) {
            if (no(dbRoot)) {
                dbRoot = findNodeByPath("/" + NodePath.ROOT, true);
            }
            return dbRoot;
        }
    }

    /**
     * Gets account name from the root node associated with whoever owns 'node'
     */
    @PerfMon(category = "read")
    public String getNodeOwner(MongoSession ms, SubNode node) {
        if (no(node.getOwner())) {
            throw new RuntimeEx("Node has null owner: " + XString.prettyPrint(node));
        }
        SubNode userNode = read.getNode(ms, node.getOwner());
        return userNode.getStr(NodeProp.USER.s());
    }

    public String getParentPath(SubNode node) {
        return XString.truncateAfterLast(node.getPath(), "/");
    }

    @PerfMon(category = "read")
    public long getChildCount(MongoSession ms, SubNode node) {
        if (MongoRepository.PARENT_OPTIMIZATION && ok(node.getId())) {
            return getChildCount(ms, node.getId());
        } else {
            return getChildCount(ms, node.getPath());
        }
    }

    @PerfMon(category = "read")
    public long getChildCount(MongoSession ms, ObjectId parentId) {
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PARENT).is(parentId);
        q.addCriteria(crit);
        return ops.count(q, SubNode.class);
    }

    @PerfMon(category = "read")
    public long getChildCount(MongoSession ms, String path) {
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(path));
        q.addCriteria(crit);
        return ops.count(q, SubNode.class);
    }

    @PerfMon(category = "read(m,n)")
    public boolean hasChildren(MongoSession ms, SubNode node) {
        if (MongoRepository.PARENT_OPTIMIZATION && ok(node.getId())) {
            return hasChildren(ms, node.getId());
        } else {
            return hasChildren(ms, node.getPath());
        }
    }

    @PerfMon(category = "read(m,pth)")
    public boolean hasChildren(MongoSession ms, String path) {
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(path));
        q.addCriteria(crit);
        return ops.exists(q, SubNode.class);
    }

    @PerfMon(category = "read")
    public boolean hasChildren(MongoSession ms, ObjectId parentId) {
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PARENT).is(parentId);
        q.addCriteria(crit);
        return ops.exists(q, SubNode.class);
    }

    @PerfMon(category = "read")
    public long getNodeCount(MongoSession ms) {
        if (no(ms)) {
            ms = auth.getAdminSession();
        }
        Query q = new Query();
        return ops.count(q, SubNode.class);
    }

    /* Throws an exception if the parent of 'node' does not exist */
    public void checkParentExists(MongoSession ms, SubNode node) {
        boolean isRootPath = mongoUtil.isRootPath(node.getPath());
        if (node.isDisableParentCheck() || isRootPath)
            return;

        String parentPath = getParentPath(node);
        if (no(parentPath) || parentPath.equals("") || parentPath.equals("/") || parentPath.equals("/r")
                || parentPath.equals(NodePath.PENDING_PATH) || parentPath.equals(NodePath.PENDING_PATH + "/"))
            return;

        if (parentPath.startsWith(NodePath.PENDING_PATH + "/")) {
            parentPath = parentPath.replace(NodePath.PENDING_PATH + "/", "/r/");
        }

        // no need to check root.
        if (parentPath.equals("/r") || parentPath.equals("/r/")) {
            return;
        }

        SubNode parentNode = read.getNode(ms, parentPath, false);
        if (ok(parentNode))
            return;

        // log.debug("Verifying parent path exists: " + parentPath);
        Query q = new Query();
        q.addCriteria(Criteria.where(SubNode.PATH).is(parentPath));

        if (!ops.exists(q, SubNode.class)) {
            throw new RuntimeEx("Attempted to add a node before its parent exists:" + parentPath);
        }
    }

    @PerfMon(category = "read")
    public SubNode getNodeByName(MongoSession ms, String name) {
        return getNodeByName(ms, name, true);
    }

    /*
     * The name can have either of two different formats:
     * 
     * 1) "nodeName" (admin owned node)
     * 
     * 2) "userName:nodeName" (a named node some user has created)
     */
    @PerfMon(category = "read")
    public SubNode getNodeByName(MongoSession ms, String name, boolean allowAuth) {
        Query q = new Query();

        if (no(name))
            return null;
        // we tolerate a prefix at the FRONT of either format 1, or 2, and ignore it.
        name = XString.stripIfStartsWith(name, ":");
        // log.debug("getNodeByName: " + name);

        ObjectId nodeOwnerId;
        int colonIdx = -1;
        SubNode userNode = null;

        /*
         * if 'name' doesn't contain a colon it's known to be just an admin-owned global named node without
         * a user prefix
         */
        if ((colonIdx = name.indexOf(":")) == -1) {
            nodeOwnerId = mongoUtil.getSystemRootNode().getOwner();
            // log.debug("no leading colon, so this is expected to have admin owner=" +
            // nodeOwnerId.toHexString());
        }
        /*
         * If there is a colon in the name then it's of the format 'userName:nodeName'
         */
        else {
            String userName = name.substring(0, colonIdx);

            /*
             * pass a null session here to cause adminSession to be used which is required to get a user node,
             * but it always safe to get this node this way here.
             */
            userNode = getUserNodeByUserName(null, userName);
            nodeOwnerId = userNode.getOwner();
            name = name.substring(colonIdx + 1);
        }

        q.addCriteria(Criteria.where(SubNode.NAME).is(name)//
                .and(SubNode.OWNER).is(nodeOwnerId));

        SubNode ret = mongoUtil.findOne(q);

        if (ok(ret)) {
            // log.debug("Node found: id=" + ret.getIdStr());
        }

        if (allowAuth) {
            auth.auth(ms, ret, PrivilegeType.READ);
        }

        return ret;
    }

    @PerfMon(category = "read(m,i)")
    public SubNode getNode(MongoSession ms, String identifier) {
        // calling thru proxy for AOP here.
        return read.getNode(ms, identifier, true);
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
     * 6) special named location, like '~sn:inbox', or '~sn:friendList' (starts with tilde)
     *    (we support just '~inbox' also as a type shorthand where the sn: is missing)
     * </pre>
     */
    @PerfMon(category = "read(m,i,a)")
    public SubNode getNode(MongoSession ms, String identifier, boolean allowAuth) {
        if (no(identifier))
            return null;

        if (identifier.equals("/")) {
            throw new RuntimeEx(
                    "SubNode doesn't implement the root node. Root is implicit and never needs an actual node to represent it.");
        }
        // log.debug("getNode identifier=" + identifier);
        SubNode ret = null;

        if (identifier.startsWith("~")) {
            String typeName = identifier.substring(1);
            if (!typeName.startsWith("sn:")) {
                typeName = "sn:" + typeName;
            }
            ret = read.getUserNodeByType(ms, ms.getUserName(), null, null, typeName, null, null);
        }
        // Node name lookups are done by prefixing the search with a colon (:)
        else if (identifier.startsWith(":")) {
            ret = read.getNodeByName(ms, identifier.substring(1), allowAuth);
        }
        // If search doesn't start with a slash then it's a nodeId and not a path
        else if (!identifier.startsWith("/")) {
            ret = read.getNode(ms, new ObjectId(identifier), allowAuth);
        }
        // otherwise this is a path lookup
        else {
            ret = read.findNodeByPath(identifier, true);
        }

        if (allowAuth) {
            auth.auth(ms, ret, PrivilegeType.READ);
        }
        return ret;
    }

    @PerfMon(category = "read")
    public SubNode findNodeByPath(String path, boolean useCache) {
        path = XString.stripIfEndsWith(path, "/");
        SubNode ret = useCache ? ThreadLocals.getCachedNode(path) : null;
        if (no(ret)) {
            Query q = new Query();
            q.addCriteria(Criteria.where(SubNode.PATH).is(path));
            ret = mongoUtil.findOne(q);
        }
        return ret;
    }

    public boolean nodeExists(MongoSession ms, ObjectId id) {
        Query q = new Query();
        q.addCriteria(Criteria.where(SubNode.ID).is(id));
        return ops.exists(q, SubNode.class);
    }

    @PerfMon(category = "read(m,o)")
    public SubNode getNode(MongoSession ms, ObjectId objId) {
        return read.getNode(ms, objId, true);
    }

    @PerfMon(category = "read")
    public SubNode getOwner(MongoSession ms, SubNode node, boolean allowAuth) {
        return read.getNode(ms, node.getOwner(), allowAuth);
    }

    @PerfMon(category = "read(m,o,a)")
    public SubNode getNode(MongoSession ms, ObjectId objId, boolean allowAuth) {
        SubNode ret = mongoUtil.findById(objId);
        if (ok(ret) && allowAuth) {
            auth.auth(ms, ret, PrivilegeType.READ);
        }
        return ret;
    }

    /*
     * todo-2: Need to implement a save hook/callback capability in the MongoListener so we can get
     * notifications sent to any threads that are waiting to lookup a node once it exists, but we will
     * STILL probably need to DO the lookup so we don't have concurrent access threading bug.
     */
    @PerfMon(category = "read(m,o,a,r)")
    public SubNode getNode(MongoSession ms, ObjectId objId, boolean allowAuth, int retries) {
        SubNode ret = read.getNode(ms, objId, allowAuth);
        while (no(ret) && retries-- > 0) {
            Util.sleep(3000);
            ret = read.getNode(ms, objId, allowAuth);
        }
        return ret;
    }

    public SubNode getParent(MongoSession ms, SubNode node) {
        return getParent(ms, node, true);
    }

    public SubNode getParent(MongoSession ms, SubNode node, boolean allowAuth) {
        return MongoRepository.PARENT_OPTIMIZATION && ok(node.getParent()) ? //
                read.getNode(ms, node.getParent(), allowAuth) : getParentByPath(ms, node.getPath(), allowAuth);
    }

    /*
     * WARNING: This always converts a 'pending' path to a non-pending one (/r/p/ v.s. /r/)
     */
    @PerfMon(category = "read")
    public SubNode getParentByPath(MongoSession ms, String path, boolean allowAuth) {
        if ("/".equals(path)) {
            return null;
        }
        String parentPath = XString.truncateAfterLast(path, "/");
        if (StringUtils.isEmpty(parentPath))
            return null;

        String pendingPath = NodePath.PENDING_PATH + "/";
        String rootPath = "/" + NodePath.ROOT + "/";

        /*
         * If node is in pending area take the pending part out of the path to get the real parent
         */
        parentPath = parentPath.replace(pendingPath, rootPath);

        SubNode ret = read.getNode(ms, parentPath);
        if (ok(ret) && allowAuth) {
            auth.auth(ms, ret, PrivilegeType.READ);
        }

        return ret;
    }

    public List<SubNode> getChildrenAsList(MongoSession ms, SubNode node, boolean ordered, Integer limit) {
        Iterable<SubNode> iter = getChildren(ms, node, ordered ? Sort.by(Sort.Direction.ASC, SubNode.ORDINAL) : null, limit, 0);
        return iterateToList(iter);
    }

    public List<SubNode> iterateToList(Iterable<SubNode> iter) {
        if (!iter.iterator().hasNext()) {
            return null;
        }
        List<SubNode> list = new LinkedList<>();
        iter.forEach(list::add);
        return list;
    }

    @PerfMon(category = "read")
    public List<String> getChildrenIds(MongoSession ms, SubNode node, boolean ordered, Integer limit) {
        auth.auth(ms, node, PrivilegeType.READ);

        Query q = new Query();
        if (ok(limit)) {
            q.limit(limit.intValue());
        }

        /*
         * This regex finds all that START WITH "path/" and then end with some other string that does NOT
         * contain "/", so that we know it's not at a deeper level of the tree, but is immediate children of
         * 'node'
         * 
         * ^:aa:bb:([^:])*$
         * 
         * example: To find all DIRECT children (non-recursive) under path /aa/bb regex is
         * ^\/aa\/bb\/([^\/])*$ (Note that in the java string the \ becomes \\ below...)
         * 
         */
        Criteria crit = null;
        if (MongoRepository.PARENT_OPTIMIZATION && ok(node.getParent())) {
            crit = Criteria.where(SubNode.PARENT).is(node.getParent());
        } else {
            crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(no(node) ? "" : node.getPath()));
        }

        if (ordered) {
            q.with(Sort.by(Sort.Direction.ASC, SubNode.ORDINAL));
        }
        q.addCriteria(crit);

        Iterable<SubNode> iter = mongoUtil.find(q);
        List<String> nodeIds = new LinkedList<>();
        for (SubNode n : iter) {
            nodeIds.add(n.getIdStr());
        }
        return nodeIds;
    }

    /*
     * Gets children under the parent of parentId. Relies on PARENTs of all nodes to be set properly
     * which theoretically CAN be wrong, and so bewear that only getChildrenUnderPath is guaranteed to
     * be correct, because the single source of truth about tree structure is path (PTH)
     */
    @PerfMon(category = "read")
    public Iterable<SubNode> getChildren(MongoSession ms, ObjectId parentId, Sort sort, Integer limit, int skip,
            TextCriteria textCriteria, Criteria moreCriteria) {

        Query q = new Query();
        if (ok(limit) && limit.intValue() > 0) {
            q.limit(limit.intValue());
        }

        if (skip > 0) {
            q.skip(skip);
        }

        Criteria crit = Criteria.where(SubNode.PARENT).is(parentId);

        if (ok(textCriteria)) {
            q.addCriteria(textCriteria);
        }

        if (ok(moreCriteria)) {
            q.addCriteria(moreCriteria);
        }

        if (ok(sort)) {
            q.with(sort);
        }

        q.addCriteria(crit);
        return mongoUtil.find(q);
    }

    /*
     * If node is null it's path is considered empty string, and it represents the 'root' of the tree.
     * There is no actual NODE that is root node.
     */
    @PerfMon(category = "read(pth)")
    public Iterable<SubNode> getChildren(MongoSession ms, String path, Sort sort, Integer limit, int skip,
            TextCriteria textCriteria, Criteria moreCriteria) {

        Query q = new Query();
        if (ok(limit) && limit.intValue() > 0) {
            q.limit(limit.intValue());
        }

        if (skip > 0) {
            q.skip(skip);
        }

        /*
         * This regex finds all that START WITH "path/" and then end with some other string that does NOT
         * contain "/", so that we know it's not at a deeper level of the tree, but is immediate children of
         * 'node'
         * 
         * ^:aa:bb:([^:])*$
         * 
         * example: To find all DIRECT children (non-recursive) under path /aa/bb regex is
         * ^\/aa\/bb\/([^\/])*$ (Note that in the java string the \ becomes \\ below...)
         * 
         */
        Criteria crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(path));

        if (ok(textCriteria)) {
            q.addCriteria(textCriteria);
        }

        if (ok(moreCriteria)) {
            q.addCriteria(moreCriteria);
        }

        if (ok(sort)) {
            q.with(sort);
        }

        q.addCriteria(crit);
        return mongoUtil.find(q);
    }

    /*
     * If node is null it's path is considered empty string, and it represents the 'root' of the tree.
     * There is no actual NODE that is root node
     */
    public Iterable<SubNode> getChildren(MongoSession ms, SubNode node, Sort sort, Integer limit, int skip) {
        auth.auth(ms, node, PrivilegeType.READ);

        if (MongoRepository.PARENT_OPTIMIZATION && ok(node.getId())) {
            return read.getChildren(ms, node.getId(), sort, limit, skip, null, null);
        } else {
            return read.getChildren(ms, node.getPath(), sort, limit, skip, null, null);
        }
    }

    public Iterable<SubNode> getChildren(MongoSession ms, SubNode node) {
        return read.getChildren(ms, node, null, null, 0);
    }

    /*
     * All we need to do here is query for children an do a "max(ordinal)" operation on that, but
     * digging the information off the web for how to do this appears to be something that may take a
     * few hours so i'm skipping it for now and just doing an inverse sort on ORDER and pulling off the
     * top one and using that for my MAX operation. AFAIK this might even be the most efficient
     * approach. Who knows.
     */
    @PerfMon(category = "read")
    public Long getMaxChildOrdinal(MongoSession ms, SubNode node) {
        // Do not delete this commented stuff. Can be helpful to get aggregates
        // working.
        // MatchOperation match = new
        // MatchOperation(Criteria.where("quantity").gt(quantity));
        // GroupOperation group =
        // Aggregation.group("giftCard").sum("giftCard").as("count");
        // Aggregation aggregate = Aggregation.newAggregation(match, group);
        // Order is deprecated
        // AggregationResults<Order> orderAggregate = ops.aggregate(aggregate, "order",
        // Order.class);
        // Aggregation agg = Aggregation.newAggregation(//
        // Aggregation.match(Criteria.where("quantity").gt(1)), //
        // Aggregation.group(SubNode.FIELD_ORDINAL).max().as("count"));
        //
        // AggregationResults<SubNode> results = ops.aggregate(agg, "order",
        // SubNode.class);
        // List<SubNode> orderCount = results.getMappedResults();

        auth.auth(ms, node, PrivilegeType.READ);

        // todo-2: research if there's a way to query for just one, rather than simply
        // callingfindOne at the end? What's best practice here?
        Query q = new Query();
        Criteria crit = MongoRepository.PARENT_OPTIMIZATION && ok(node.getId()) ? //
                Criteria.where(SubNode.PARENT).is(node.getId())
                : Criteria.where(SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(node.getPath()));
        q.with(Sort.by(Sort.Direction.DESC, SubNode.ORDINAL));
        q.addCriteria(crit);

        // for 'findOne' is it also advantageous to also setup the query criteria with
        // something like LIMIT=1 (sql)?
        SubNode nodeFound = mongoUtil.findOne(q);
        if (no(nodeFound)) {
            return 0L;
        }
        return nodeFound.getOrdinal();
    }

    @PerfMon(category = "read")
    public SubNode getSiblingAbove(MongoSession ms, SubNode node) {
        auth.auth(ms, node, PrivilegeType.READ);

        if (no(node.getOrdinal())) {
            node.setOrdinal(0L);
        }

        // todo-2: research if there's a way to query for just one, rather than simply
        // calling findOne at the end? What's best practice here?
        Query q = new Query();
        Criteria crit = null;
        if (MongoRepository.PARENT_OPTIMIZATION && ok(node.getParent())) {
            crit = Criteria.where(SubNode.PARENT).is(node.getParent());
        } else {
            crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(node.getParentPath()));
        }
        q.with(Sort.by(Sort.Direction.DESC, SubNode.ORDINAL));
        q.addCriteria(crit);

        // leave this example. you can do a RANGE like this.
        // query.addCriteria(Criteria.where(SubNode.FIELD_ORDINAL).lt(50).gt(20));
        q.addCriteria(Criteria.where(SubNode.ORDINAL).lt(node.getOrdinal()));

        SubNode nodeFound = mongoUtil.findOne(q);
        return nodeFound;
    }

    @PerfMon(category = "read")
    public SubNode getSiblingBelow(MongoSession ms, SubNode node) {
        auth.auth(ms, node, PrivilegeType.READ);
        if (no(node.getOrdinal())) {
            node.setOrdinal(0L);
        }

        // todo-2: research if there's a way to query for just one, rather than simply
        // calling findOne at the end? What's best practice here?
        Query q = new Query();
        Criteria crit = null;
        if (MongoRepository.PARENT_OPTIMIZATION && ok(node.getParent())) {
            crit = Criteria.where(SubNode.PARENT).is(node.getParent());
        } else {
            crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(node.getParentPath()));
        }

        q.with(Sort.by(Sort.Direction.ASC, SubNode.ORDINAL));
        q.addCriteria(crit);

        // leave this example. you can do a RANGE like this.
        // query.addCriteria(Criteria.where(SubNode.FIELD_ORDINAL).lt(50).gt(20));
        q.addCriteria(Criteria.where(SubNode.ORDINAL).gt(node.getOrdinal()));

        SubNode nodeFound = mongoUtil.findOne(q);
        return nodeFound;
    }

    /*
     * Gets (recursively) all nodes under 'node', by using all paths starting with the path of that node
     */
    public Iterable<SubNode> getSubGraph(MongoSession ms, SubNode node, Sort sort, int limit, boolean removeOrphans) {

        // The removeOrphans algo REQUIRES all nodes to be returned (NO LIMIT) or else it would cause a
        // massive
        // loss of data by removing nodes that are NOT orphans!!!
        // DO NOT REMOVE THIS CHECK!!!
        if (removeOrphans && limit > 0) {
            throw new RuntimeException("getSubGraph: invalid parameters");
        }
        auth.auth(ms, node, PrivilegeType.READ);

        Query q = new Query();
        /*
         * This regex finds all that START WITH path, have some characters after path, before the end of the
         * string. Without the trailing (.+)$ we would be including the node itself in addition to all its
         * children.
         */
        Criteria crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(node.getPath()));
        q.addCriteria(crit);

        if (ok(sort)) {
            q.with(sort);
        }

        if (limit > 0) {
            q.limit(limit);
        }

        Iterable<SubNode> iter = mongoUtil.find(q);
        return removeOrphans ? mongoUtil.filterOutOrphans(ms, node, iter) : iter;
    }

    /**
     * prop is optional and if non-null means we should search only that one field.
     * 
     * WARNING. "SubNode.prp" is a COLLECTION and therefore not searchable. Beware.
     * 
     * timeRangeType: futureOnly, pastOnly, all
     */
    @PerfMon(category = "read")
    public Iterable<SubNode> searchSubGraph(MongoSession ms, SubNode node, String prop, String text, String sortField,
            String sortDir, int limit, int skip, boolean fuzzy, boolean caseSensitive, String timeRangeType, boolean recursive,
            boolean requirePriority) {
        auth.auth(ms, node, PrivilegeType.READ);

        List<CriteriaDefinition> criterias = new LinkedList<>();
        Sort sort = null;

        /*
         * This regex finds all that START WITH path, have some characters after path, before the end of the
         * string. Without the trailing (.+)$ we would be including the node itself in addition to all its
         * children.
         */
        Criteria crit = null;
        if (recursive) {
            crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(node.getPath())); //
        } else {
            if (MongoRepository.PARENT_OPTIMIZATION && ok(node.getParent())) {
                crit = Criteria.where(SubNode.PARENT).is(node.getParent());
            } else {
                crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(node.getPath()));
            }
        }
        criterias.add(crit);

        if (!StringUtils.isEmpty(text)) {
            if (fuzzy) {
                if (StringUtils.isEmpty(prop)) {
                    prop = SubNode.CONTENT;
                }

                if (caseSensitive) {
                    criterias.add(Criteria.where(prop).regex(text));
                } else {
                    // i==insensitive (case)
                    criterias.add(Criteria.where(prop).regex(text, "i"));
                }
            } else {
                // .matchingAny("search term1", "search term2")
                // .matching("search term") // matches any that contain "serch" OR "term"
                // .matchingPhrase("search term")

                TextCriteria textCriteria = TextCriteria.forDefaultLanguage();
                textCriteria.matching(text);
                textCriteria.caseSensitive(caseSensitive);
                criterias.add(textCriteria);
            }
        }

        if (requirePriority) {
            criterias.add(Criteria.where("prp.priority.value").gt("0"));
        }

        if (!StringUtils.isEmpty(sortField)) {
            if ("prp.date.value".equals(sortField) && ok(timeRangeType)) {
                sortDir = "DESC";
                // example date RANGE condition:
                // query.addCriteria(Criteria.where("startDate").gte(startDate).lt(endDate));
                // and this 'may' be the same:
                // Query q = new
                // Query(Criteria.where("ip").is(ip).andOperator(Criteria.where("createdDate").lt(endDate),
                // Criteria.where("createdDate").gte(startDate)));
                if ("futureOnly".equals(timeRangeType)) {
                    // because we want to show the soonest items on top, for "future" query, we have
                    // to sort in order (not rev-chron)
                    sortDir = "ASC";
                    criterias.add(Criteria.where(sortField).gt(new Date().getTime()));
                } //
                else if ("pastOnly".equals(timeRangeType)) {
                    criterias.add(Criteria.where(sortField).lt(new Date().getTime()));
                }
                // if showing all dates the condition here is that there at least IS a 'date'
                // prop on the node
                else if ("all".equals(timeRangeType)) {
                    criterias.add(Criteria.where(sortField).ne(null));
                }
            }

            if (!StringUtils.isEmpty(sortField)) {
                if ("contentLength".equals(sortField)) {
                    sortDir = "ASC";
                }
                sort = Sort.by((ok(sortDir) && sortDir.equalsIgnoreCase("DESC")) ? Sort.Direction.DESC : Sort.Direction.ASC,
                        sortField);
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
            List<AggregationOperation> aggOps = new LinkedList<>();

            /*
             * MongoDB requires any TextCriteria (full-text search) to be the first op in the pipeline so we
             * process it first here
             */
            for (CriteriaDefinition c : criterias) {
                if (c instanceof TextCriteria) {
                    aggOps.add(Aggregation.match(c));
                }
            }

            /* Next we process all non-TextCriteria conditions */
            for (CriteriaDefinition c : criterias) {
                if (!(c instanceof TextCriteria)) {
                    aggOps.add(Aggregation.match(c));
                }
            }

            // calculate contentLength
            aggOps.add(Aggregation.project().andInclude(SubNode.ALL_FIELDS)//
                    .andExpression("strLenCP(cont)").as("contentLength"));

            /*
             * IMPORTANT: Having 'sort' before 'skip' and 'limit' is REQUIRED to get correct behavior, because
             * with aggregates we doing a step by step pipeline of processing so we need records in the correct
             * order before we do limit or skip and so the ordering of these 'ops' does that.
             */
            aggOps.add(Aggregation.sort(sort));
            aggOps.add(Aggregation.skip((long) skip));
            aggOps.add(Aggregation.limit(limit));

            Aggregation agg = Aggregation.newAggregation(aggOps);

            AggregationResults<SubNode> results = ops.aggregate(agg, SubNode.class, SubNode.class);
            return results.getMappedResults();
        }
        // Otherwise a standard Query.
        else {
            Query q = new Query();

            for (CriteriaDefinition c : criterias) {
                q.addCriteria(c);
            }

            if (ok(sort)) {
                q.with(sort);
            }

            if (limit > 0) {
                q.limit(limit);
            }

            if (skip > 0) {
                q.skip(skip);
            }

            return mongoUtil.find(q);
        }
    }

    /**
     * Special purpose query to get all nodes that have a "date" property.
     */
    public Iterable<SubNode> getCalendar(MongoSession ms, SubNode node) {
        auth.auth(ms, node, PrivilegeType.READ);

        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(node.getPath()));

        /*
         * this mod time condition is simply to be sure the user has 'saved' the node and not pick up new
         * node currently being crafted
         */
        crit = crit.and(SubNode.MODIFY_TIME).ne(null);
        q.addCriteria(crit);
        q.addCriteria(Criteria.where(SubNode.PROPERTIES + "." + NodeProp.DATE + ".value").ne(null));

        return mongoUtil.find(q);
    }

    /*
     * todo-2: This is very low hanging fruit to make this a feature on the Search menu. In other words
     * implementing an "All Named Nodes" search would be trivial with this.
     */
    public Iterable<SubNode> getNamedNodes(MongoSession ms, SubNode node) {
        auth.auth(ms, node, PrivilegeType.READ);

        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(node.getPath()));
        crit = crit.and(SubNode.NAME).ne(null);
        q.addCriteria(crit);

        return mongoUtil.find(q);
    }

    /*
     * Accepts either the 'userName' or the 'userNode' for the user. It's best to pass userNode if you
     * have it, to avoid a DB query.
     */
    @PerfMon(category = "read")
    public SubNode getUserNodeByType(MongoSession ms, String userName, SubNode userNode, String content, String type,
            List<String> defaultPrivs, String defaultName) {
        if (no(userNode)) {
            if (no(userName)) {
                userName = ThreadLocals.getSC().getUserName();
            }
            userNode = read.getUserNodeByUserName(ms, userName);
        }

        if (no(userNode)) {
            log.warn("userNode not found for user name: " + userName);
            return null;
        }

        SubNode node = read.findSubNodeByType(ms, userNode, type);

        if (no(node)) {
            node = create.createNode(ms, userNode, null, type, 0L, CreateNodeLocation.LAST, null, null, true);
            node.setOwner(userNode.getId());

            if (no(content)) {
                content = getDefaultContentForNamedNode(type);
            }
            node.setContent(content);
            node.touch();

            if (ok(defaultName)) {
                node.setName(defaultName);
            }

            if (ok(defaultPrivs)) {
                acl.addPrivilege(ms, node, PrincipalName.PUBLIC.s(), defaultPrivs, null);
            }

            update.save(ms, node);
        }

        /*
         * todo-2: fix this? Ensure if "sn:posts" node type does exist that it's also named 'posts' this is
         * a retrofit (data repair) here, and not the standard flow.
         */
        if (ok(node) && NodeType.POSTS.s().equals(type) && !NodeName.POSTS.equals(node.getName())) {
            node.setName(NodeName.POSTS);
            acl.addPrivilege(ms, node, PrincipalName.PUBLIC.s(), Arrays.asList(PrivilegeType.READ.s()), null);
            update.save(ms, node);
        }
        return node;
    }

    public String getDefaultContentForNamedNode(String type) {
        if (type.equals(NodeType.EXPORTS.s())) {
            return "### Exports";
        }

        if (type.equals(NodeType.FRIEND_LIST.s())) {
            return "### Friends List";
        }

        if (type.equals(NodeType.BLOCKED_USERS.s())) {
            return "### Blocked Users";
        }

        if (type.equals(NodeType.POSTS.s())) {
            return "### " + ThreadLocals.getSC().getUserName() + "'s Public Posts";
        }

        if (type.equals(NodeType.NOTES.s())) {
            return "### Notes";
        }

        if (type.equals(NodeType.BOOKMARK_LIST.s())) {
            return "### Bookmarks";
        }

        return "Node: " + type;
    }

    public String convertIfLocalName(String userName) {
        if (!userName.endsWith("@" + prop.getMetaHost())) {
            return userName;
        }
        int atIdx = userName.indexOf("@");
        if (atIdx == -1)
            return userName;
        return userName.substring(0, atIdx);
    }

    public SubNode getUserNodeByUserName(MongoSession ms, String user) {
        return read.getUserNodeByUserName(ms, user, true);
    }

    @PerfMon(category = "read")
    public SubNode getUserNodeByUserName(MongoSession ms, String user, boolean allowAuth) {
        String cacheKey = "USRNODE-" + user;
        SubNode ret = ThreadLocals.getCachedNode(cacheKey);
        if (ok(ret)) {
            return ret;
        }
        if (no(user)) {
            user = ThreadLocals.getSC().getUserName();
        }
        user = user.trim();

        // if user name ends with "@domain.com" for example, truncate it after the '@'
        // character.
        user = convertIfLocalName(user);

        if (no(ms)) {
            ms = auth.getAdminSession();
        }

        // For the ADMIN user their root node is considered to be the entire root of the
        // whole DB
        if (PrincipalName.ADMIN.s().equalsIgnoreCase(user)) {
            return getDbRoot();
        }

        // Other wise for ordinary users root is based off their username
        Query q = new Query();

        Criteria crit = null;

        // Note: This one CAN get called before allUsersRootNode is set.
        if (MongoRepository.PARENT_OPTIMIZATION && ok(MongoUtil.allUsersRootNode)) {
            crit = Criteria.where(SubNode.PARENT).is(MongoUtil.allUsersRootNode.getId()) //
                    .and(SubNode.PROPERTIES + "." + NodeProp.USER + ".value").regex("^" + user + "$");
        } else {
            crit = Criteria.where(//
                    SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(NodePath.ROOT_OF_ALL_USERS)) //
                    // .and(SubNode.FIELD_PROPERTIES + "." + NodeProp.USER + ".value").is(user);
                    // case-insensitive lookup of username:
                    .and(SubNode.PROPERTIES + "." + NodeProp.USER + ".value").regex("^" + user + "$");
        }

        q.addCriteria(crit);

        ret = mongoUtil.findOne(q);
        if (allowAuth) {
            auth.auth(ms, ret, PrivilegeType.READ);
        }
        if (ok(ret)) {
            ThreadLocals.cacheNode(cacheKey, ret);
        }
        return ret;
    }

    /*
     * Finds and returns the first node matching userName and type under the 'node', or null if not
     * existing
     */
    @PerfMon(category = "read")
    public SubNode findNodeByUserAndType(MongoSession ms, SubNode node, String userName, String type) {

        // Other wise for ordinary users root is based off their username
        Query q = new Query();
        Criteria crit = null;
        if (MongoRepository.PARENT_OPTIMIZATION && ok(node.getId())) {
            crit = Criteria.where(SubNode.PARENT).is(node.getId()) //
                    .and(SubNode.TYPE).is(type).and(SubNode.PROPERTIES + "." + NodeProp.USER + ".value").is(userName);
        } else {
            crit = Criteria.where(//
                    SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(node.getPath()))//
                    .and(SubNode.TYPE).is(type).and(SubNode.PROPERTIES + "." + NodeProp.USER + ".value").is(userName);
        }

        q.addCriteria(crit);
        SubNode ret = mongoUtil.findOne(q);

        // auth.auth(session, ret, PrivilegeType.READ);
        return ret;
    }

    /*
     * Finds the first node matching 'type' under 'path' (non-recursively, direct children only)
     */
    @PerfMon(category = "read")
    public SubNode findSubNodeByType(MongoSession ms, SubNode node, String type) {

        // Other wise for ordinary users root is based off their username
        Query q = new Query();
        Criteria crit = null;
        if (MongoRepository.PARENT_OPTIMIZATION && ok(node.getId())) {
            crit = Criteria.where(SubNode.PARENT).is(node.getId()) //
                    .and(SubNode.TYPE).is(type);
        } else {
            crit = Criteria.where(//
                    SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(node.getPath()))//
                    .and(SubNode.TYPE).is(type);
        }

        q.addCriteria(crit);
        SubNode ret = mongoUtil.findOne(q);

        auth.auth(ms, ret, PrivilegeType.READ);
        return ret;
    }

    // ========================================================================
    // Typed Node Under Path
    // ========================================================================

    /*
     * Finds the first node matching 'type' under 'path' (non-recursively, direct children only)
     */
    public Iterable<SubNode> findSubNodesByType(MongoSession ms, SubNode node, String type) {
        Query q = typedNodesUnderPath_query(ms, node, type);
        return mongoUtil.find(q);
    }

    /*
     * Finds the first node matching 'type' under 'path' (non-recursively, direct children only)
     */
    public long countTypedNodesUnderPath(MongoSession ms, SubNode node, String type) {
        Query q = typedNodesUnderPath_query(ms, node, type);
        return ops.count(q, SubNode.class);
    }

    public Query typedNodesUnderPath_query(MongoSession ms, SubNode node, String type) {
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(node.getPath()))//
                .and(SubNode.TYPE).is(type);

        q.addCriteria(crit);
        return q;
    }

    // ========================================================================

    /*
     * Returns one (or first) node contained directly under path (non-recursively) that has a matching
     * propName and propVal
     */
    @PerfMon(category = "read")
    public SubNode findNodeByProp(MongoSession ms, SubNode node, String propName, String propVal) {

        // Other wise for ordinary users root is based off their username
        Query q = new Query();
        Criteria crit = null;

        if (MongoRepository.PARENT_OPTIMIZATION && ok(node.getId())) {
            crit = Criteria.where(SubNode.PARENT).is(node.getId()) //
                    .and(SubNode.PROPERTIES + "." + propName + ".value").is(propVal);
        } else {
            crit = Criteria.where(//
                    SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(node.getPath()))//
                    .and(SubNode.PROPERTIES + "." + propName + ".value").is(propVal);
        }

        q.addCriteria(crit);
        SubNode ret = mongoUtil.findOne(q);
        auth.auth(ms, ret, PrivilegeType.READ);
        return ret;
    }

    /*
     * Same as findSubNodeByProp but returns multiples. Finda ALL nodes contained directly under path
     * (non-recursively) that has a matching propName and propVal
     */
    @PerfMon(category = "read")
    public Iterable<SubNode> findNodesByProp(MongoSession ms, String path, String propName, String propVal) {

        // Other wise for ordinary users root is based off their username
        Query q = new Query();
        Criteria crit = Criteria.where(//
                SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(path))//
                .and(SubNode.PROPERTIES + "." + propName + ".value").is(propVal);

        q.addCriteria(crit);
        return mongoUtil.find(q);
    }

    /*
     * Returns one (or first) node that has a matching propName and propVal
     */
    public SubNode findNodeByProp(MongoSession ms, String propName, String propVal) {
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.PROPERTIES + "." + propName + ".value").is(propVal);
        q.addCriteria(crit);
        SubNode ret = mongoUtil.findOne(q);
        auth.auth(ms, ret, PrivilegeType.READ);
        return ret;
    }

    public SubNode findByIPFSPinned(MongoSession ms, String cid) {
        Query q = new Query();

        /* Match the PIN to cid */
        Criteria crit = Criteria.where(SubNode.PROPERTIES + "." + NodeProp.IPFS_LINK.s() + ".value").is(cid);

        /* And only consider nodes that are NOT REFs (meaning IPFS_REF prop==null) */
        crit = crit.and(SubNode.PROPERTIES + "." + NodeProp.IPFS_REF.s() + ".value").is(null);

        q.addCriteria(crit);
        SubNode ret = mongoUtil.findOne(q);
        auth.auth(ms, ret, PrivilegeType.READ);
        return ret;
    }
}
