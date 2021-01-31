package org.subnode.mongo;

import java.util.LinkedList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.TextCriteria;
import org.springframework.stereotype.Component;
import org.subnode.config.AppProp;
import org.subnode.config.NodeName;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.model.client.PrincipalName;
import org.subnode.model.client.PrivilegeType;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;

@Component
public class MongoRead {
    private static final Logger log = LoggerFactory.getLogger(MongoRead.class);

    /*
     * always access this thru 'getOps()' so we can be sure to always save all dirty nodes before doing
     * any reads, and be sure we can't read any inconsistent data. This is similar to an RDBMS
     * 'Transaction Isolation' that disables dirty reads
     */
    @Autowired
    private MongoTemplate _ops;

    @Autowired
    private MongoCreate create;

    @Autowired
    private MongoUpdate update;

    @Autowired
    private MongoAuth auth;

    @Autowired
    private MongoUtil util;

    @Autowired
    private AppProp appProp;

    private MongoTemplate getOps(MongoSession session) {
        update.saveSession(session);
        return _ops;
    }

    /**
     * Gets account name from the root node associated with whoever owns 'node'
     */
    public String getNodeOwner(MongoSession session, SubNode node) {
        if (node.getOwner() == null) {
            throw new RuntimeEx("Node has null owner: " + XString.prettyPrint(node));
        }
        SubNode userNode = getNode(session, node.getOwner());
        return userNode.getStrProp(NodeProp.USER.s());
    }

    public ObjectId getOwnerNodeIdFromSession(MongoSession session) {
        ObjectId ownerId = null;

        if (session.getUserNode() != null) {
            ownerId = session.getUserNode().getOwner();
        } else {
            SubNode ownerNode = getUserNodeByUserName(auth.getAdminSession(), session.getUserName());
            if (ownerNode == null) {
                /*
                 * slight mod to help bootstrapping when the admin doesn't initially have an ownernode until created
                 */
                if (!session.isAdmin()) {
                    throw new RuntimeEx("No user node found for user: " + session.getUserName());
                } else
                    return null;
            } else {
                ownerId = ownerNode.getOwner();
            }
        }

        if (ownerId == null) {
            throw new RuntimeEx("Unable to get ownerId from the session.");
        }

        // if we return null, it indicates the owner is Admin.
        return ownerId;
    }

    public String getParentPath(SubNode node) {
        return XString.truncateAfterLast(node.getPath(), "/");
    }

    public long getChildCount(MongoSession session, SubNode node) {
        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexDirectChildrenOfPath(node.getPath()));
        query.addCriteria(criteria);
        return getOps(session).count(query, SubNode.class);
    }

    public boolean hasChildren(MongoSession session, SubNode node) {
        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexDirectChildrenOfPath(node.getPath()));
        query.addCriteria(criteria);
        return getOps(session).exists(query, SubNode.class);
    }

    public long getNodeCount(MongoSession session) {
        if (session == null) {
            session = auth.getAdminSession();
        }
        Query query = new Query();
        return getOps(session).count(query, SubNode.class);
    }

    public SubNode getChildAt(MongoSession session, SubNode node, long idx) {
        auth.auth(session, node, PrivilegeType.READ);
        Query query = new Query();
        Criteria criteria = Criteria.where(//
                SubNode.FIELD_PATH).regex(util.regexDirectChildrenOfPath(node.getPath()))//
                .and(SubNode.FIELD_ORDINAL).is(idx);
        query.addCriteria(criteria);

        SubNode ret = getOps(session).findOne(query, SubNode.class);
        return ret;
    }

    public void checkParentExists(MongoSession session, SubNode node) {
        boolean isRootPath = util.isRootPath(node.getPath());
        if (node.isDisableParentCheck() || isRootPath)
            return;

        String parentPath = getParentPath(node);
        if (parentPath == null || parentPath.equals("") || parentPath.equals("/"))
            return;

        // log.debug("Verifying parent path exists: " + parentPath);
        Query query = new Query();
        query.addCriteria(Criteria.where(SubNode.FIELD_PATH).is(parentPath));

        if (!getOps(session).exists(query, SubNode.class)) {
            throw new RuntimeEx("Attempted to add a node before its parent exists:" + parentPath);
        }
    }

    public SubNode getNodeByName(MongoSession session, String name) {
        return getNodeByName(session, name, true);
    }

    /*
     * The name can have either of two different formats:
     * 
     * 1) "nodeName" (admin owned node)
     * 
     * 2) "userName:nodeName" (a named node some user has created)
     */
    public SubNode getNodeByName(MongoSession session, String name, boolean allowAuth) {
        Query query = new Query();

        if (name == null)
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
            nodeOwnerId = util.getSystemRootNode().getOwner();
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

        query.addCriteria(Criteria.where(SubNode.FIELD_NAME).is(name)//
                .and(SubNode.FIELD_OWNER).is(nodeOwnerId));

        SubNode ret = getOps(session).findOne(query, SubNode.class);

        if (ret != null) {
            log.debug("Node found: id=" + ret.getId().toHexString());
        }

        if (allowAuth) {
            auth.auth(session, ret, PrivilegeType.READ);
        }
        return ret;
    }

    public SubNode getNode(MongoSession session, String path) {
        return getNode(session, path, true);
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
    public SubNode getNode(MongoSession session, String identifier, boolean allowAuth) {
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
            ret = getUserNodeByType(session, session.getUserName(), null, null, typeName);
        }
        // Node name lookups are done by prefixing the search with a colon (:)
        else if (identifier.startsWith(":")) {
            ret = getNodeByName(session, identifier.substring(1), allowAuth);
        }
        // If search doesn't start with a slash then it's a nodeId and not a path
        else if (!identifier.startsWith("/")) {
            ret = getNode(session, new ObjectId(identifier), allowAuth);
        } else {
            // log.debug("getNode identifier is path. doing path find.");
            identifier = XString.stripIfEndsWith(identifier, "/");
            Query query = new Query();
            query.addCriteria(Criteria.where(SubNode.FIELD_PATH).is(identifier));

            ret = getOps(session).findOne(query, SubNode.class);
            // if (ret == null) {
            // log.debug("nope. path not found.");
            // } else {
            // log.debug("Path found: " + identifier);
            // }
        }

        if (allowAuth) {
            auth.auth(session, ret, PrivilegeType.READ);
        }
        return ret;
    }

    public boolean nodeExists(MongoSession session, ObjectId id) {
        Query query = new Query();
        query.addCriteria(Criteria.where(SubNode.FIELD_ID).is(id));

        return getOps(session).exists(query, SubNode.class);
    }

    public SubNode getNode(MongoSession session, ObjectId objId) {
        return getNode(session, objId, true);
    }

    public SubNode getNode(MongoSession session, ObjectId objId, boolean allowAuth) {
        if (objId == null)
            return null;

        SubNode ret = getOps(session).findById(objId, SubNode.class);
        if (allowAuth) {
            auth.auth(session, ret, PrivilegeType.READ);
        }
        return ret;
    }

    public SubNode getParent(MongoSession session, SubNode node) {
        String path = node.getPath();
        if ("/".equals(path)) {
            return null;
        }
        String parentPath = XString.truncateAfterLast(path, "/");

        /* If node is in pending area take the pending part out of the path to get the real parent */
        parentPath = parentPath.replace("/r/p/", "/r/");

        Query query = new Query();
        query.addCriteria(Criteria.where(SubNode.FIELD_PATH).is(parentPath));

        SubNode ret = getOps(session).findOne(query, SubNode.class);
        auth.auth(session, ret, PrivilegeType.READ);
        return ret;
    }

    public List<SubNode> getChildrenAsList(MongoSession session, SubNode node, boolean ordered, Integer limit) {
        Iterable<SubNode> iter =
                getChildren(session, node, ordered ? Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL) : null, limit, 0);
        return iterateToList(iter);
    }

    public List<SubNode> iterateToList(Iterable<SubNode> iter) {
        if (!iter.iterator().hasNext()) {
            return null;
        }
        List<SubNode> list = new LinkedList<SubNode>();
        iter.forEach(list::add);
        return list;
    }

    public List<String> getChildrenIds(MongoSession session, SubNode node, boolean ordered, Integer limit) {
        auth.auth(session, node, PrivilegeType.READ);

        Query query = new Query();
        if (limit != null) {
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
                Criteria.where(SubNode.FIELD_PATH).regex(util.regexDirectChildrenOfPath(node == null ? "" : node.getPath()));
        if (ordered) {
            query.with(Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL));
        }
        query.addCriteria(criteria);

        Iterable<SubNode> iter = getOps(session).find(query, SubNode.class);
        List<String> nodeIds = new LinkedList<String>();
        for (SubNode n : iter) {
            nodeIds.add(n.getId().toHexString());
        }
        return nodeIds;
    }

    /*
     * If node is null it's path is considered empty string, and it represents the 'root' of the tree.
     * There is no actual NODE that is root node,
     */
    public Iterable<SubNode> getChildrenUnderParentPath(MongoSession session, String path, Sort sort, Integer limit, int skip) {

        Query query = new Query();
        if (limit != null) {
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
        Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexDirectChildrenOfPath(path));

        if (sort != null) {
            query.with(sort);
        }

        query.addCriteria(criteria);
        return getOps(session).find(query, SubNode.class);
    }

    /*
     * If node is null it's path is considered empty string, and it represents the 'root' of the tree.
     * There is no actual NODE that is root node
     */
    public Iterable<SubNode> getChildren(MongoSession session, SubNode node, Sort sort, Integer limit, int skip) {
        auth.auth(session, node, PrivilegeType.READ);
        return getChildrenUnderParentPath(session, node.getPath(), sort, limit, skip);
    }

    /*
     * All we need to do here is query for children an do a "max(ordinal)" operation on that, but
     * digging the information off the web for how to do this appears to be something that may take a
     * few hours so i'm skipping it for now and just doing an inverse sort on ORDER and pulling off the
     * top one and using that for my MAX operation. AFAIK this might even be the most efficient
     * approach. Who knows. MongoDb is stil the wild wild west of databases.
     */
    public Long getMaxChildOrdinal(MongoSession session, SubNode node) {
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
        auth.auth(session, node, PrivilegeType.READ);

        // todo-2: research if there's a way to query for just one, rather than simply
        // callingfindOne at the end? What's best practice here?
        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexDirectChildrenOfPath(node.getPath()));
        query.with(Sort.by(Sort.Direction.DESC, SubNode.FIELD_ORDINAL));
        query.addCriteria(criteria);

        // for 'findOne' is it also advantageous to also setup the query criteria with
        // something like LIMIT=1 (sql)?
        SubNode nodeFound = getOps(session).findOne(query, SubNode.class);
        if (nodeFound == null) {
            return 0L;
        }
        return nodeFound.getOrdinal();
    }

    public SubNode getNewestChild(MongoSession session, SubNode node) {
        auth.auth(session, node, PrivilegeType.READ);

        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexDirectChildrenOfPath(node.getPath()));
        query.with(Sort.by(Sort.Direction.DESC, SubNode.FIELD_MODIFY_TIME));
        query.addCriteria(criteria);

        SubNode nodeFound = getOps(session).findOne(query, SubNode.class);
        return nodeFound;
    }

    public SubNode getSiblingAbove(MongoSession session, SubNode node) {
        auth.auth(session, node, PrivilegeType.READ);

        if (node.getOrdinal() == null) {
            throw new RuntimeEx("can't get node above node with null ordinal.");
        }

        // todo-2: research if there's a way to query for just one, rather than simply
        // calling findOne at the end? What's best practice here?
        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexDirectChildrenOfPath(node.getParentPath()));
        query.with(Sort.by(Sort.Direction.DESC, SubNode.FIELD_ORDINAL));
        query.addCriteria(criteria);

        // leave this example. you can do a RANGE like this.
        // query.addCriteria(Criteria.where(SubNode.FIELD_ORDINAL).lt(50).gt(20));
        query.addCriteria(Criteria.where(SubNode.FIELD_ORDINAL).lt(node.getOrdinal()));

        SubNode nodeFound = getOps(session).findOne(query, SubNode.class);
        return nodeFound;
    }

    public SubNode getSiblingBelow(MongoSession session, SubNode node) {
        auth.auth(session, node, PrivilegeType.READ);
        if (node.getOrdinal() == null) {
            throw new RuntimeEx("can't get node above node with null ordinal.");
        }

        // todo-2: research if there's a way to query for just one, rather than simply
        // calling findOne at the end? What's best practice here?
        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexDirectChildrenOfPath(node.getParentPath()));
        query.with(Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL));
        query.addCriteria(criteria);

        // leave this example. you can do a RANGE like this.
        // query.addCriteria(Criteria.where(SubNode.FIELD_ORDINAL).lt(50).gt(20));
        query.addCriteria(Criteria.where(SubNode.FIELD_ORDINAL).gt(node.getOrdinal()));

        SubNode nodeFound = getOps(session).findOne(query, SubNode.class);
        return nodeFound;
    }

    /*
     * Gets (recursively) all nodes under 'node', by using all paths starting with the path of that node
     */
    public Iterable<SubNode> getSubGraph(MongoSession session, SubNode node) {
        auth.auth(session, node, PrivilegeType.READ);

        Query query = new Query();
        /*
         * This regex finds all that START WITH path, have some characters after path, before the end of the
         * string. Without the trailing (.+)$ we would be including the node itself in addition to all its
         * children.
         */
        Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(node.getPath()));
        query.addCriteria(criteria);

        return getOps(session).find(query, SubNode.class);
    }

    // =========================================================================
    // Followers Query
    // =========================================================================

    public Iterable<SubNode> findFollowersOfUser(MongoSession session, String userName) {
        update.saveSession(session);
        Query query = followersOfUser_query(session, userName);
        if (query == null)
            return null;
        return getOps(session).find(query, SubNode.class);
    }

    public long countFollowersOfUser(MongoSession session, String userName) {
        update.saveSession(session);
        Query query = followersOfUser_query(session, userName);
        if (query == null)
            return 0L;
        return getOps(session).count(query, SubNode.class);
    }

    public Query followersOfUser_query(MongoSession session, String userName) {
        Query query = new Query();

        Criteria criteria =
                Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(NodeName.ROOT_OF_ALL_USERS)) //
                        .and(SubNode.FIELD_PROPERTIES + "." + NodeProp.USER.s()).is(userName) //
                        .and(SubNode.FIELD_TYPE).is(NodeType.FRIEND.s());

        query.addCriteria(criteria);
        return query;
    }

    // =========================================================================
    // Following Query
    // =========================================================================

    /* Returns FRIEND nodes for every user 'userName' is following */
    public Iterable<SubNode> findFollowingOfUser(MongoSession session, String userName) {
        update.saveSession(session);

        Query query = findFollowingOfUser_query(session, userName);
        if (query == null)
            return null;

        return getOps(session).find(query, SubNode.class);
    }

    public long countFollowingOfUser(MongoSession session, String userName) {
        update.saveSession(session);

        Query query = findFollowingOfUser_query(session, userName);
        if (query == null)
            return 0;

        return getOps(session).count(query, SubNode.class);
    }

    private Query findFollowingOfUser_query(MongoSession session, String userName) {
        Query query = new Query();

        // get friends list node
        SubNode friendsListNode = getUserNodeByType(session, userName, null, null, NodeType.FRIEND_LIST.s());
        if (friendsListNode == null)
            return null;

        // query all the friends under
        Criteria criteria = Criteria.where(SubNode.FIELD_PATH) //
                .regex(util.regexRecursiveChildrenOfPath(friendsListNode.getPath())) //
                .and(SubNode.FIELD_TYPE).is(NodeType.FRIEND.s());

        query.addCriteria(criteria);
        return query;
    }

    // =========================================================================

    /**
     * prop is optional and if non-null means we should search only that one field.
     * 
     * WARNING. "SubNode.prp" is a COLLECTION and therefore not searchable. Beware.
     */
    public Iterable<SubNode> searchSubGraph(MongoSession session, SubNode node, String prop, String text, String sortField,
            int limit, boolean fuzzy, boolean caseSensitive) {
        auth.auth(session, node, PrivilegeType.READ);

        Query query = new Query();

        if (limit > 0) {
            query.limit(limit);
        }
        /*
         * This regex finds all that START WITH path, have some characters after path, before the end of the
         * string. Without the trailing (.+)$ we would be including the node itself in addition to all its
         * children.
         */
        Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(node.getPath()));
        query.addCriteria(criteria);

        if (!StringUtils.isEmpty(text)) {

            if (fuzzy) {
                if (StringUtils.isEmpty(prop)) {
                    prop = SubNode.FIELD_CONTENT;
                }

                if (caseSensitive) {
                    query.addCriteria(Criteria.where(prop).regex(text));
                } else {
                    // i==insensitive (case)
                    query.addCriteria(Criteria.where(prop).regex(text, "i"));
                }
            } else {
                // /////
                // Query query = Query.query(
                // Criteria.where("aBooleanProperty").is(true).
                // and(anIntegerProperty).is(1)).
                // addCriteria(TextCriteria.
                // forLanguage("en"). // effectively the same as forDefaultLanguage() here
                // matching("a text that is indexed for full text search")));

                // List<YourDocumentType> result = mongoTemplate.findAll(query.
                // YourDocumentType.class);
                // /////

                TextCriteria textCriteria = TextCriteria.forDefaultLanguage();
                populateTextCriteria(textCriteria, text);
                textCriteria.caseSensitive(caseSensitive);
                query.addCriteria(textCriteria);
            }
        }

        if (!StringUtils.isEmpty(sortField)) {
            // todo-1: sort dir is being passed from client but not used here?
            query.with(Sort.by(Sort.Direction.DESC, sortField));
        }

        return getOps(session).find(query, SubNode.class);
    }

    /**
     * Special purpose query to get nodes that have dueDate or time properties.
     */
    public Iterable<SubNode> getCalendar(MongoSession session, SubNode node) {
        auth.auth(session, node, PrivilegeType.READ);

        Query query = new Query();
        // query.limit(limit);

        Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(node.getPath()));
        criteria = criteria.and(SubNode.FIELD_MODIFY_TIME).ne(null);

        query.addCriteria(criteria);
        query.addCriteria(Criteria.where(SubNode.FIELD_PROPERTIES + "." + NodeProp.DATE + ".value").ne(null));

        return getOps(session).find(query, SubNode.class);
    }

    /*
     * todo-1: This is very low hanging fruit to make this a feature on the Search menu
     */
    public Iterable<SubNode> getNamedNodes(MongoSession session, SubNode node) {
        auth.auth(session, node, PrivilegeType.READ);

        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(node.getPath()));
        criteria = criteria.and(SubNode.FIELD_NAME).ne(null);
        query.addCriteria(criteria);

        return getOps(session).find(query, SubNode.class);
    }

    /*
     * Builds the 'criteria' object using the kind of searching Google does where anything in quotes is
     * considered a phrase and anything else separated by spaces are separate search terms.
     */
    public static void populateTextCriteria(TextCriteria criteria, String text) {
        String regex = "\"([^\"]*)\"|(\\S+)";

        Matcher m = Pattern.compile(regex).matcher(text);
        while (m.find()) {
            if (m.group(1) != null) {
                String str = m.group(1);
                log.debug("SEARCH: Quoted [" + str + "]");
                criteria.matchingPhrase(str);
            } else {
                String str = m.group(2);
                log.debug("SEARCH: Plain [" + str + "]");
                criteria.matching(str);
            }
        }
    }

    /*
     * Accepts either the 'user' or the 'userNode' for the user. It's best to pass userNode if you have
     * it, to avoid a DB query.
     */
    public SubNode getUserNodeByType(MongoSession session, String user, SubNode userNode, String nodeName, String type) {
        if (userNode == null) {
            if (user == null) {
                user = ThreadLocals.getSessionContext().getUserName();
            }
            userNode = getUserNodeByUserName(session, user);
        }

        if (userNode == null) {
            log.warn("userNode not found for user name: " + user);
            return null;
        }

        String path = userNode.getPath();
        SubNode node = findTypedNodeUnderPath(session, path, type);

        if (node == null) {
            node = create.createNode(session, userNode, null, type, 0L, CreateNodeLocation.LAST, null, null);
            node.setOwner(userNode.getId());
            node.setContent(nodeName);
            update.save(session, node);
        }
        return node;
    }

    public String convertIfLocalName(String userName) {
        if (!userName.endsWith("@" + appProp.getMetaHost())) {
            return userName;
        }
        int atIdx = userName.indexOf("@");
        if (atIdx == -1)
            return userName;
        return userName.substring(0, atIdx);
    }

    public SubNode getUserNodeByUserName(MongoSession session, String user) {
        if (user == null) {
            user = ThreadLocals.getSessionContext().getUserName();
        }
        user = user.trim();

        // if user name ends with "@domain.com" for example, truncate it after the '@'
        // character.
        user = convertIfLocalName(user);

        if (session == null) {
            session = auth.getAdminSession();
        }

        // For the ADMIN user their root node is considered to be the entire root of the
        // whole DB
        if (PrincipalName.ADMIN.s().equalsIgnoreCase(user)) {
            return getNode(session, "/" + NodeName.ROOT);
        }

        // Other wise for ordinary users root is based off their username
        Query query = new Query();
        Criteria criteria = Criteria.where(//
                SubNode.FIELD_PATH).regex(util.regexDirectChildrenOfPath(NodeName.ROOT_OF_ALL_USERS))//
                .and(SubNode.FIELD_PROPERTIES + "." + NodeProp.USER + ".value").is(user);

        query.addCriteria(criteria);

        SubNode ret = getOps(session).findOne(query, SubNode.class);
        auth.auth(session, ret, PrivilegeType.READ);
        return ret;
    }

    /*
     * Finds and returns the FRIEND node matching userName under the friendsListNode, or null if not
     * existing
     */
    public SubNode findFriendOfUser(MongoSession session, SubNode friendsListNode, String userName) {

        // Other wise for ordinary users root is based off their username
        Query query = new Query();
        Criteria criteria = Criteria.where(//
                SubNode.FIELD_PATH).regex(util.regexDirectChildrenOfPath(friendsListNode.getPath()))//
                .and(SubNode.FIELD_TYPE).is(NodeType.FRIEND.s()) //
                .and(SubNode.FIELD_PROPERTIES + "." + NodeProp.USER + ".value").is(userName);

        query.addCriteria(criteria);
        SubNode ret = getOps(session).findOne(query, SubNode.class);

        // auth.auth(session, ret, PrivilegeType.READ);
        return ret;
    }

    /*
     * Finds the first node matching 'type' under 'path' (non-recursively, direct children only)
     */
    public SubNode findTypedNodeUnderPath(MongoSession session, String path, String type) {

        // Other wise for ordinary users root is based off their username
        Query query = new Query();
        Criteria criteria = Criteria.where(//
                SubNode.FIELD_PATH).regex(util.regexDirectChildrenOfPath(path))//
                .and(SubNode.FIELD_TYPE).is(type);

        query.addCriteria(criteria);
        SubNode ret = getOps(session).findOne(query, SubNode.class);

        auth.auth(session, ret, PrivilegeType.READ);
        return ret;
    }

    // ========================================================================
    // Typed Node Under Path
    // ========================================================================

    /*
     * Finds the first node matching 'type' under 'path' (non-recursively, direct children only)
     */
    public Iterable<SubNode> findTypedNodesUnderPath(MongoSession session, String path, String type) {
        Query query = typedNodesUnderPath_query(session, path, type);
        return getOps(session).find(query, SubNode.class);
    }

    /*
     * Finds the first node matching 'type' under 'path' (non-recursively, direct children only)
     */
    public long countTypedNodesUnderPath(MongoSession session, String path, String type) {
        Query query = typedNodesUnderPath_query(session, path, type);
        return getOps(session).count(query, SubNode.class);
    }

    public Query typedNodesUnderPath_query(MongoSession session, String path, String type) {
        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(path))//
                .and(SubNode.FIELD_TYPE).is(type);

        query.addCriteria(criteria);
        return query;
    }

    // ========================================================================


    /*
     * Returns one (or first) node contained directly under path (non-recursively) that has a matching
     * propName and propVal
     */
    public SubNode findSubNodeByProp(MongoSession session, String path, String propName, String propVal) {

        // Other wise for ordinary users root is based off their username
        Query query = new Query();
        Criteria criteria = Criteria.where(//
                SubNode.FIELD_PATH).regex(util.regexDirectChildrenOfPath(path))//
                .and(SubNode.FIELD_PROPERTIES + "." + propName + ".value").is(propVal);

        query.addCriteria(criteria);
        SubNode ret = getOps(session).findOne(query, SubNode.class);
        auth.auth(session, ret, PrivilegeType.READ);
        return ret;
    }

    /*
     * Same as findSubNodeByProp but returns multiples. Finda ALL nodes contained directly under path
     * (non-recursively) that has a matching propName and propVal
     */
    public Iterable<SubNode> findSubNodesByProp(MongoSession session, String path, String propName, String propVal) {

        // Other wise for ordinary users root is based off their username
        Query query = new Query();
        Criteria criteria = Criteria.where(//
                SubNode.FIELD_PATH).regex(util.regexDirectChildrenOfPath(path))//
                .and(SubNode.FIELD_PROPERTIES + "." + propName + ".value").is(propVal);

        query.addCriteria(criteria);
        return getOps(session).find(query, SubNode.class);
    }

    /*
     * Returns one (or first) node that has a matching propName and propVal
     */
    public SubNode findSubNodeByProp(MongoSession session, String propName, String propVal) {
        Query query = new Query();
        Criteria criteria = Criteria.where(SubNode.FIELD_PROPERTIES + "." + propName + ".value").is(propVal);
        query.addCriteria(criteria);
        SubNode ret = getOps(session).findOne(query, SubNode.class);
        auth.auth(session, ret, PrivilegeType.READ);
        return ret;
    }
}
