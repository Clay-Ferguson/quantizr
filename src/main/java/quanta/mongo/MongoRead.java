package quanta.mongo;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.Arrays;
import java.util.Date;
import java.util.LinkedList;
import java.util.List;
import javax.annotation.PostConstruct;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.CriteriaDefinition;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.TextCriteria;
import org.springframework.stereotype.Component;
import quanta.config.NodeName;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
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

    private static final Object dbRootLock = new Object();
    private SubNode dbRoot;

    @PostConstruct
	public void postConstruct() {
		read = this;
	}

    // we call this during app init so we don't need to have thread safety here the rest of the time.
    public SubNode getDbRoot() {
        synchronized (dbRootLock) {
            if (no(dbRoot)) {
                dbRoot = findNodeByPath("/" + NodePath.ROOT);
            }
            return dbRoot;
        }
    }

    /**
     * Gets account name from the root node associated with whoever owns 'node'
     */
    public String getNodeOwner(MongoSession ms, SubNode node) {
        if (no(node.getOwner())) {
            throw new RuntimeEx("Node has null owner: " + XString.prettyPrint(node));
        }
        SubNode userNode = getNode(ms, node.getOwner());
        return userNode.getStr(NodeProp.USER.s());
    }

    public String getParentPath(SubNode node) {
        return XString.truncateAfterLast(node.getPath(), "/");
    }

    public long getChildCount(MongoSession ms, SubNode node) {
        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(node.getPath()));
        query.addCriteria(criteria);
        return ops.count(query, SubNode.class);
    }

    public boolean hasChildren(MongoSession ms, SubNode node) {
        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(node.getPath()));
        query.addCriteria(criteria);
        return ops.exists(query, SubNode.class);
    }

    public long getNodeCount(MongoSession ms) {
        if (no(ms)) {
            ms = auth.getAdminSession();
        }
        Query query = new Query();
        return ops.count(query, SubNode.class);
    }

    public SubNode getChildAt(MongoSession ms, SubNode node, long idx) {
        auth.auth(ms, node, PrivilegeType.READ);
        Query query = new Query();
        Criteria criteria = Criteria.where(//
                SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(node.getPath()))//
                .and(SubNode.ORDINAL).is(idx);
        query.addCriteria(criteria);

        SubNode ret = mongoUtil.findOne(query);
        return ret;
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

        SubNode parentNode = getNode(ms, parentPath, false);
        if (ok(parentNode))
            return;

        // log.debug("Verifying parent path exists: " + parentPath);
        Query query = new Query();
        query.addCriteria(Criteria.where(SubNode.PATH).is(parentPath));

        if (!ops.exists(query, SubNode.class)) {
            throw new RuntimeEx("Attempted to add a node before its parent exists:" + parentPath);
        }
    }

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
    public SubNode getNodeByName(MongoSession ms, String name, boolean allowAuth) {
        Query query = new Query();

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

        query.addCriteria(Criteria.where(SubNode.NAME).is(name)//
                .and(SubNode.OWNER).is(nodeOwnerId));

        SubNode ret = mongoUtil.findOne(query);

        if (ok(ret)) {
            // log.debug("Node found: id=" + ret.getIdStr());
        }

        if (allowAuth) {
            auth.auth(ms, ret, PrivilegeType.READ);
        }

        return ret;
    }

    public SubNode getNode(MongoSession ms, String identifier) {
        return getNode(ms, identifier, true);
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
            ret = getUserNodeByType(ms, ms.getUserName(), null, null, typeName, null, null);
        }
        // Node name lookups are done by prefixing the search with a colon (:)
        else if (identifier.startsWith(":")) {
            ret = getNodeByName(ms, identifier.substring(1), allowAuth);
        }
        // If search doesn't start with a slash then it's a nodeId and not a path
        else if (!identifier.startsWith("/")) {
            ret = getNode(ms, new ObjectId(identifier), allowAuth);
        }
        // otherwise this is a path lookup
        else {
            ret = findNodeByPath(identifier);
        }

        if (allowAuth) {
            auth.auth(ms, ret, PrivilegeType.READ);
        }
        return ret;
    }

    public SubNode findNodeByPath(String path) {
        path = XString.stripIfEndsWith(path, "/");
        SubNode ret = ThreadLocals.getCachedNode(path);
        if (no(ret)) {
            Query query = new Query();
            query.addCriteria(Criteria.where(SubNode.PATH).is(path));
            ret = mongoUtil.findOne(query);
        }
        return ret;
    }

    public boolean nodeExists(MongoSession ms, ObjectId id) {
        Query query = new Query();
        query.addCriteria(Criteria.where(SubNode.ID).is(id));
        return ops.exists(query, SubNode.class);
    }

    public SubNode getNode(MongoSession ms, ObjectId objId) {
        return getNode(ms, objId, true);
    }

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
    public SubNode getNode(MongoSession ms, ObjectId objId, boolean allowAuth, int retries) {
        SubNode ret = getNode(ms, objId, allowAuth);
        while (no(ret) && retries-- > 0) {
            Util.sleep(3000);
            ret = getNode(ms, objId, allowAuth);
        }
        return ret;
    }

    public SubNode getParent(MongoSession ms, SubNode node) {
        return getParent(ms, node, true);
    }

    /*
     * WARNING: This always converts a 'pending' path to a non-pending one (/r/p/ v.s. /r/)
     */
    public SubNode getParent(MongoSession ms, SubNode node, boolean allowAuth) {
        String path = node.getPath();
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

        SubNode ret = getNode(ms, parentPath);
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

    public List<String> getChildrenIds(MongoSession ms, SubNode node, boolean ordered, Integer limit) {
        auth.auth(ms, node, PrivilegeType.READ);

        Query query = new Query();
        if (ok(limit)) {
            query.limit(limit.intValue());
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
        Criteria criteria =
                Criteria.where(SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(no(node) ? "" : node.getPath()));
        if (ordered) {
            query.with(Sort.by(Sort.Direction.ASC, SubNode.ORDINAL));
        }
        query.addCriteria(criteria);

        Iterable<SubNode> iter = mongoUtil.find(query);
        List<String> nodeIds = new LinkedList<>();
        for (SubNode n : iter) {
            nodeIds.add(n.getIdStr());
        }
        return nodeIds;
    }

    /*
     * If node is null it's path is considered empty string, and it represents the 'root' of the tree.
     * There is no actual NODE that is root node,
     */
    public Iterable<SubNode> getChildrenUnderPath(MongoSession ms, String path, Sort sort, Integer limit, int skip,
            TextCriteria textCriteria, Criteria moreCriteria) {

        Query query = new Query();
        if (ok(limit) && limit.intValue() > 0) {
            query.limit(limit.intValue());
        }

        if (skip > 0) {
            query.skip(skip);
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
        Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(path));

        if (ok(textCriteria)) {
            query.addCriteria(textCriteria);
        }

        if (ok(moreCriteria)) {
            query.addCriteria(moreCriteria);
        }

        if (ok(sort)) {
            query.with(sort);
        }

        query.addCriteria(criteria);
        return mongoUtil.find(query);
    }

    /*
     * If node is null it's path is considered empty string, and it represents the 'root' of the tree.
     * There is no actual NODE that is root node
     */
    public Iterable<SubNode> getChildren(MongoSession ms, SubNode node, Sort sort, Integer limit, int skip) {
        auth.auth(ms, node, PrivilegeType.READ);
        return getChildrenUnderPath(ms, node.getPath(), sort, limit, skip, null, null);
    }

    public Iterable<SubNode> getChildren(MongoSession ms, SubNode node) {
        auth.auth(ms, node, PrivilegeType.READ);
        return getChildrenUnderPath(ms, node.getPath(), null, null, 0, null, null);
    }

    /*
     * All we need to do here is query for children an do a "max(ordinal)" operation on that, but
     * digging the information off the web for how to do this appears to be something that may take a
     * few hours so i'm skipping it for now and just doing an inverse sort on ORDER and pulling off the
     * top one and using that for my MAX operation. AFAIK this might even be the most efficient
     * approach. Who knows.
     */
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
        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(node.getPath()));
        query.with(Sort.by(Sort.Direction.DESC, SubNode.ORDINAL));
        query.addCriteria(criteria);

        // for 'findOne' is it also advantageous to also setup the query criteria with
        // something like LIMIT=1 (sql)?
        SubNode nodeFound = mongoUtil.findOne(query);
        if (no(nodeFound)) {
            return 0L;
        }
        return nodeFound.getOrdinal();
    }

    public SubNode getNewestChild(MongoSession ms, SubNode node) {
        auth.auth(ms, node, PrivilegeType.READ);

        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(node.getPath()));
        query.with(Sort.by(Sort.Direction.DESC, SubNode.MODIFY_TIME));
        query.addCriteria(criteria);

        SubNode nodeFound = mongoUtil.findOne(query);
        return nodeFound;
    }

    public SubNode getSiblingAbove(MongoSession ms, SubNode node) {
        auth.auth(ms, node, PrivilegeType.READ);

        if (no(node.getOrdinal())) {
            node.setOrdinal(0L);
        }

        // todo-2: research if there's a way to query for just one, rather than simply
        // calling findOne at the end? What's best practice here?
        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(node.getParentPath()));
        query.with(Sort.by(Sort.Direction.DESC, SubNode.ORDINAL));
        query.addCriteria(criteria);

        // leave this example. you can do a RANGE like this.
        // query.addCriteria(Criteria.where(SubNode.FIELD_ORDINAL).lt(50).gt(20));
        query.addCriteria(Criteria.where(SubNode.ORDINAL).lt(node.getOrdinal()));

        SubNode nodeFound = mongoUtil.findOne(query);
        return nodeFound;
    }

    public SubNode getSiblingBelow(MongoSession ms, SubNode node) {
        auth.auth(ms, node, PrivilegeType.READ);
        if (no(node.getOrdinal())) {
            node.setOrdinal(0L);
        }

        // todo-2: research if there's a way to query for just one, rather than simply
        // calling findOne at the end? What's best practice here?
        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(node.getParentPath()));
        query.with(Sort.by(Sort.Direction.ASC, SubNode.ORDINAL));
        query.addCriteria(criteria);

        // leave this example. you can do a RANGE like this.
        // query.addCriteria(Criteria.where(SubNode.FIELD_ORDINAL).lt(50).gt(20));
        query.addCriteria(Criteria.where(SubNode.ORDINAL).gt(node.getOrdinal()));

        SubNode nodeFound = mongoUtil.findOne(query);
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

        Query query = new Query();
        /*
         * This regex finds all that START WITH path, have some characters after path, before the end of the
         * string. Without the trailing (.+)$ we would be including the node itself in addition to all its
         * children.
         */
        Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(node.getPath()));
        query.addCriteria(criteria);

        if (ok(sort)) {
            query.with(sort);
        }

        if (limit > 0) {
            query.limit(limit);
        }

        Iterable<SubNode> iter = mongoUtil.find(query);
        return removeOrphans ? mongoUtil.filterOutOrphans(ms, node, iter) : iter;
    }

    /**
     * prop is optional and if non-null means we should search only that one field.
     * 
     * WARNING. "SubNode.prp" is a COLLECTION and therefore not searchable. Beware.
     * 
     * timeRangeType: futureOnly, pastOnly, all
     */
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
        Criteria criteria = recursive ? //
                Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(node.getPath())) //
                : Criteria.where(SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(node.getPath()));
        criterias.add(criteria);

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
                // Query query = new
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
            Query query = new Query();

            for (CriteriaDefinition c : criterias) {
                query.addCriteria(c);
            }

            if (ok(sort)) {
                query.with(sort);
            }

            if (limit > 0) {
                query.limit(limit);
            }

            if (skip > 0) {
                query.skip(skip);
            }

            return mongoUtil.find(query);
        }
    }

    /**
     * Special purpose query to get all nodes that have a "date" property.
     */
    public Iterable<SubNode> getCalendar(MongoSession ms, SubNode node) {
        auth.auth(ms, node, PrivilegeType.READ);

        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(node.getPath()));

        /*
         * this mod time condition is simply to be sure the user has 'saved' the node and not pick up new
         * node currently being crafted
         */
        criteria = criteria.and(SubNode.MODIFY_TIME).ne(null);
        query.addCriteria(criteria);
        query.addCriteria(Criteria.where(SubNode.PROPERTIES + "." + NodeProp.DATE + ".value").ne(null));

        return mongoUtil.find(query);
    }

    /*
     * todo-2: This is very low hanging fruit to make this a feature on the Search menu. In other words
     * implementing an "All Named Nodes" search would be trivial with this.
     */
    public Iterable<SubNode> getNamedNodes(MongoSession ms, SubNode node) {
        auth.auth(ms, node, PrivilegeType.READ);

        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(node.getPath()));
        criteria = criteria.and(SubNode.NAME).ne(null);
        query.addCriteria(criteria);

        return mongoUtil.find(query);
    }

    /*
     * Accepts either the 'userName' or the 'userNode' for the user. It's best to pass userNode if you have
     * it, to avoid a DB query.
     */
    public SubNode getUserNodeByType(MongoSession ms, String userName, SubNode userNode, String content, String type,
            List<String> defaultPrivs, String defaultName) {
        if (no(userNode)) {
            if (no(userName)) {
                userName = ThreadLocals.getSC().getUserName();
            }
            userNode = getUserNodeByUserName(ms, userName);
        }

        if (no(userNode)) {
            log.warn("userNode not found for user name: " + userName);
            return null;
        }

        String path = userNode.getPath();
        SubNode node = findTypedNodeUnderPath(ms, path, type);

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
        return getUserNodeByUserName(ms, user, true);
    }

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
        Query query = new Query();
        Criteria criteria = Criteria.where(//
                SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(NodePath.ROOT_OF_ALL_USERS)) //
                // .and(SubNode.FIELD_PROPERTIES + "." + NodeProp.USER + ".value").is(user);
                // case-insensitive lookup of username:
                .and(SubNode.PROPERTIES + "." + NodeProp.USER + ".value").regex("^" + user + "$", "i");

        query.addCriteria(criteria);

        ret = mongoUtil.findOne(query);
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
    public SubNode findNodeByUserAndType(MongoSession ms, SubNode node, String userName, String type) {

        // Other wise for ordinary users root is based off their username
        Query query = new Query();
        Criteria criteria = Criteria.where(//
                SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(node.getPath()))//
                .and(SubNode.TYPE).is(type).and(SubNode.PROPERTIES + "." + NodeProp.USER + ".value").is(userName);

        query.addCriteria(criteria);
        SubNode ret = mongoUtil.findOne(query);

        // auth.auth(session, ret, PrivilegeType.READ);
        return ret;
    }

    /*
     * Finds the first node matching 'type' under 'path' (non-recursively, direct children only)
     */
    public SubNode findTypedNodeUnderPath(MongoSession ms, String path, String type) {

        // Other wise for ordinary users root is based off their username
        Query query = new Query();
        Criteria criteria = Criteria.where(//
                SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(path))//
                .and(SubNode.TYPE).is(type);

        query.addCriteria(criteria);
        SubNode ret = mongoUtil.findOne(query);

        auth.auth(ms, ret, PrivilegeType.READ);
        return ret;
    }

    // ========================================================================
    // Typed Node Under Path
    // ========================================================================

    /*
     * Finds the first node matching 'type' under 'path' (non-recursively, direct children only)
     */
    public Iterable<SubNode> findTypedNodesUnderPath(MongoSession ms, String path, String type) {
        Query query = typedNodesUnderPath_query(ms, path, type);
        return mongoUtil.find(query);
    }

    /*
     * Finds the first node matching 'type' under 'path' (non-recursively, direct children only)
     */
    public long countTypedNodesUnderPath(MongoSession ms, String path, String type) {
        Query query = typedNodesUnderPath_query(ms, path, type);
        return ops.count(query, SubNode.class);
    }

    public Query typedNodesUnderPath_query(MongoSession ms, String path, String type) {
        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(path))//
                .and(SubNode.TYPE).is(type);

        query.addCriteria(criteria);
        return query;
    }

    // ========================================================================

    /*
     * Returns one (or first) node contained directly under path (non-recursively) that has a matching
     * propName and propVal
     */
    public SubNode findNodeByProp(MongoSession ms, String path, String propName, String propVal) {

        // Other wise for ordinary users root is based off their username
        Query query = new Query();
        Criteria criteria = Criteria.where(//
                SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(path))//
                .and(SubNode.PROPERTIES + "." + propName + ".value").is(propVal);

        query.addCriteria(criteria);
        SubNode ret = mongoUtil.findOne(query);
        auth.auth(ms, ret, PrivilegeType.READ);
        return ret;
    }

    /*
     * Same as findSubNodeByProp but returns multiples. Finda ALL nodes contained directly under path
     * (non-recursively) that has a matching propName and propVal
     */
    public Iterable<SubNode> findNodesByProp(MongoSession ms, String path, String propName, String propVal) {

        // Other wise for ordinary users root is based off their username
        Query query = new Query();
        Criteria criteria = Criteria.where(//
                SubNode.PATH).regex(mongoUtil.regexDirectChildrenOfPath(path))//
                .and(SubNode.PROPERTIES + "." + propName + ".value").is(propVal);

        query.addCriteria(criteria);
        return mongoUtil.find(query);
    }

    /*
     * Returns one (or first) node that has a matching propName and propVal
     */
    public SubNode findNodeByProp(MongoSession ms, String propName, String propVal) {
        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.PROPERTIES + "." + propName + ".value").is(propVal);
        query.addCriteria(criteria);
        SubNode ret = mongoUtil.findOne(query);
        auth.auth(ms, ret, PrivilegeType.READ);
        return ret;
    }

    public SubNode findByIPFSPinned(MongoSession ms, String cid) {
        Query query = new Query();

        /* Match the PIN to cid */
        Criteria criteria = Criteria.where(SubNode.PROPERTIES + "." + NodeProp.IPFS_LINK.s() + ".value").is(cid);

        /* And only consider nodes that are NOT REFs (meaning IPFS_REF prop==null) */
        criteria = criteria.and(SubNode.PROPERTIES + "." + NodeProp.IPFS_REF.s() + ".value").is(null);

        query.addCriteria(criteria);
        SubNode ret = mongoUtil.findOne(query);
        auth.auth(ms, ret, PrivilegeType.READ);
        return ret;
    }
}
