package quanta.mongo;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Random;
import java.util.regex.Pattern;
import org.apache.commons.codec.digest.DigestUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.BulkOperations.BulkMode;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexField;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.data.mongodb.core.index.TextIndexDefinition;
import org.springframework.data.mongodb.core.index.TextIndexDefinition.TextIndexDefinitionBuilder;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.client.Attachment;
import quanta.model.client.NodeLink;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.SubNode;
import quanta.util.Const;
import quanta.util.ExUtil;
import quanta.util.ImageUtil;
import quanta.util.TL;
import quanta.util.XString;
import quanta.util.val.IntVal;
import quanta.util.val.Val;

/**
 * Verious utilities related to MongoDB persistence
 */
@Component
public class MongoUtil extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(MongoUtil.class);
    private static final Random rand = new Random();

    /*
     * removed lower-case 'r' and 'p' since those are 'root' and 'pending' (see setPendingPath), and we
     * need very performant way to translate from /r/p to /r path and vice verse
     */
    static final String PATH_CHARS = "0123456789ABCDEFGHIJKLMNOQSTUVWXYZabcdefghijklmnoqstuvwxyz";

    public static void validate(SubNode node) {
        if (TL.hasDirtyNode(node.getId())) {
            log.warn("DIRTY READ (onAfterLoad): " + node.getIdStr());
        }

        if (node.getOwner() == null) {
            throw new RuntimeEx("Node has no owner: " + node.getIdStr());
            // if (svc_auth.getAdminSession() != null) {
            // node.setOwner(svc_auth.getAdminSession().getUserNodeId());
            // log.debug("Assigning admin as owner of node that had no owner (on load): " + node.getIdStr());
            // }
        }

        // Extra protection to be sure accounts and repo root can't have any sharing
        if (NodeType.ACCOUNT.s().equals(node.getType()) || NodeType.REPO_ROOT.s().equals(node.getType())) {
            if (node.getAc() != null) {
                throw new RuntimeException(
                        "Node of type " + node.getType() + " cannot have any sharing: " + node.getIdStr());
            }
        }

        // home nodes are always unpublished
        if (Const.HOME_NODE_NAME.equalsIgnoreCase(node.getName())) {
            node.set(NodeProp.UNPUBLISHED, true);
        }
        node.fixAttachments();
        node.verifyParentPath = StringUtils.isEmpty(node.getPath());
    }

    /*
     * Takes a path like "/a/b/" OR "/a/b" and finds any random longer path that's not currently used.
     * Note that since we don't require to end with "/" this function can be extending an existing leaf
     * name, or if the path does end with "/", then it has the effect of finding a new leaf from
     * scratch.
     */
    public String findAvailablePath(String path) {
        /*
         * If the path we want doesn't exist at all we can use it, so check that case first, but only if we
         * don't have a path ending with slash because that means we KNOW we need to always find a new child
         * regardless of any existing ones
         */
        if (!path.endsWith("/") && pathIsAvailable(path)) {
            return path;
        }
        int tries = 0;

        while (true) {
            // Append one random char to path. Statistically if we keep adding characters it becomes
            // exponentially more likely we find an unused path.
            path += PATH_CHARS.charAt(rand.nextInt(PATH_CHARS.length()));
            /*
             * if we encountered two misses, start adding two characters per iteration (at least), because this
             * node has lots of children
             */
            if (tries >= 2) {
                path += PATH_CHARS.charAt(rand.nextInt(PATH_CHARS.length()));
            }
            // after 3 fails get even more aggressive with 3 new chars per loop here.
            if (tries >= 3) {
                path += PATH_CHARS.charAt(rand.nextInt(PATH_CHARS.length()));
            }
            // after 4 fails get even more aggressive with 4 new chars per loop here.
            if (tries >= 4) {
                path += PATH_CHARS.charAt(rand.nextInt(PATH_CHARS.length()));
            }
            if (pathIsAvailable(path)) {
                // we must proactively delete any orphaned nodes that might be existing and would be 'ressurected'
                // which would be BAD!
                long orphans = svc_mongoDelete.simpleDeleteUnderPath(path);
                if (orphans > 0) {
                    log.debug("New Path Found: " + path + " deleted " + orphans + " orphans");
                }
                return path;
            }
            tries++;
        }
    }

    public boolean pathIsAvailable(String path) {
        Criteria crit = new Criteria();
        /*
         * Our criteria here says if the exact 'path' exists or any node starting with "${path}/" exists
         * even as an orphan (which can definitely happen) then this path it not available. So even orphaned
         * nodes can keep us from being able to consider a path 'available for use'
         */
        crit = crit.orOperator( //
                Criteria.where(SubNode.PATH).is(path), //
                svc_mongoUtil.subGraphCriteria(path));
        Query q = new Query(crit);
        Boolean ret = svc_arun.run(() -> {
            return !svc_ops.exists(q) ? Boolean.TRUE : Boolean.FALSE;
        });
        return ret;
    }

    /*
     * Make node either start with /r/p/ or else ensure that it does NOT start with /r/p
     *
     * 'p' means pending, and indicates user has not yet saved a new node they're currently editing, and
     * if they cancel the node gets orphaned and eventually cleaned up by the system automatically.
     */
    public String setPendingPathState(String path, boolean pending) {
        // ensure node starts with /r/p
        if (pending && !path.startsWith(NodePath.PENDING_PATH_S)) {
            return path.replace(NodePath.ROOT_PATH_S, NodePath.PENDING_PATH_S);
        }
        // ensure node starts with /r and not /r/p
        else if (!pending && path.startsWith(NodePath.PENDING_PATH_S)) {
            // get pending path out of the path, first
            String p = path.replace(NodePath.PENDING_PATH_S, NodePath.ROOT_PATH_S);
            p = findAvailablePath(p);
            return p;
        }
        return path;
    }

    /* Root path will start with '/' and then contain no other slashes */
    public boolean isRootPath(String path) {
        return path.startsWith("/") && path.substring(1).indexOf("/") == -1;
    }

    public String getHashOfPassword(String password) {
        if (password == null)
            return null;
        return DigestUtils.sha256Hex(password).substring(0, 20);
    }

    public void processAllNodes() {
        // Val<Long> nodesProcessed = new Val<Long>(0L);
        // Query query = new Query();
        // Criteria criteria = Criteria.where(SubNode.FIELD_ACL).ne(null);
        // query.addCriteria(criteria);
        // saveSession(session);
        // Iterable<SubNode> iter = find(query);
        // iter.forEach((node) -> {
        // nodesProcessed.setVal(nodesProcessed.getVal() + 1);
        // if (nodesProcessed.getVal() % 1000 == 0) {
        // }
        // save(session, node, true, false);
        // });
    }

    /* Returns true if there were actually some encryption keys removed */
    public boolean removeAllEncryptionKeys(SubNode node) {
        HashMap<String, AccessControl> aclMap = node.getAc();
        if (aclMap == null) {
            return false;
        }
        Val<Boolean> keysRemoved = new Val<>(false);
        aclMap.forEach((String key, AccessControl ac) -> {
            if (ac.getKey() != null) {
                ac.setKey(null);
                keysRemoved.setVal(true);
            }
        });
        return keysRemoved.getVal();
    }

    public boolean isImageAttachment(Attachment att) {
        return att != null && ImageUtil.isImageMime(att.getMime());
    }

    public int dump(String message, Iterable<SubNode> iter) {
        int count = 0;
        log.debug("    " + message);

        for (SubNode node : iter) {
            log.debug("    DUMP node: " + XString.prettyPrint(node));
            count++;
        }
        log.debug("DUMP count=" + count);
        return count;
    }

    public void rebuildIndexes() {
        dropAllIndexes();
        createAllIndexes();
    }

    // DO NOT DELETE (this method can be repurposed for other similar tasks)
    public void upgradePaths() {
        MongoTranMgr.ensureTran();
        IntVal batchSize = new IntVal();
        Query q = new Query();
        q.addCriteria(svc_mongoUtil.subGraphCriteria("/r/usr/L")); //
        BulkOperations bops = svc_ops.bulkOps(BulkMode.UNORDERED);

        svc_ops.forEach(q, node -> {
            Criteria crit = new Criteria("id").is(node.getId());
            Query query = new Query().addCriteria(crit);
            String path = node.getPath();
            if (path.startsWith("/r/usr/L")) {
                path = path.replace("/r/usr/L", "/r/usr");
            }
            Update update = new Update().set(SubNode.PATH, path);
            bops.updateOne(query, update);
            batchSize.inc();

            if (batchSize.getVal() > Const.MAX_BULK_OPS) {
                bops.execute();
                batchSize.setVal(0);
            }
        });
        if (batchSize.getVal() > 0) {
            bops.execute();
        }
    }

    public void createAllIndexes() {
        log.debug("checking all indexes.");
        // DO NOT DELETE. This is able to check contstraint volations.
        // read.dumpByPropertyMatch(NodeProp.USER.s(), "adam");

        createUniqueIndex(SubNode.PATH);

        // Other indexes that *could* be added but we don't, just as a performance enhancer is
        // Unique node names: Key = node.owner+node.name (or just node.name for admin)
        // Unique Friends: Key = node.owner+node.friendId? (meaning only ONE Friend type node per user
        // account)
        // This index is obsolete but we keep as an example of this kind of index.
        // createPartialUniqueIndex(ms, "unique-apid", SubNode.class, SubNode.PROPS + "." +
        // NodeProp.OBJECT_ID.s());

        createPartialIndex("rdf-i", SubNode.LINKS + "." + NodeLink.ID);
        createPartialUniqueIndexForType("unique-user-acct", SubNode.PROPS + "." + NodeProp.USER.s(),
                NodeType.ACCOUNT.s());

        /*
         * DO NOT DELETE: This is a good example of how to cleanup the DB of all constraint violations prior
         * to adding some new constraint. And this one was for making sure the "UniqueFriends" Index could
         * be built ok. You can't create such an index until violations of it are already removed.
         * delete.removeFriendConstraintViolations(ms);
         */

        createUniqueFriendsIndex();
        createUniqueNodeNameIndex();
        // DO NOT DELETE
        // I had done this temporarily to fix a constraint violation
        // dropIndex(ms, SubNode.class, "unique-friends");
        // dropIndex(ms, SubNode.class, "unique-node-name");
        // NOTE: Every non-admin owned noded must have only names that are prefixed with "UserName--" of
        // the user. That is, prefixed by their username followed by two dashes.
        createIndex(SubNode.NAME);
        createIndex(SubNode.TYPE);
        createIndex(SubNode.OWNER);
        createIndex(SubNode.XFR);
        createIndex(SubNode.ORDINAL);
        createIndex(SubNode.MODIFY_TIME, Direction.DESC);
        createIndex(SubNode.CREATE_TIME, Direction.DESC);
        createTextIndexes();
        logIndexes();
        log.debug("finished checking all indexes.");
    }

    /*
     * Creates an index which will guarantee no duplicate friends can be created for a given user. Note
     * this one index also makes it impossible to have the same user both blocked and followed because
     * those are both saved as FRIEND nodes on the tree and therefore would violate this constraint
     * which is exactly what we want.
     */
    public void createUniqueFriendsIndex() {
        log.debug("Creating unique friends index.");
        svc_auth.requireAdmin();
        String indexName = "unique-friends";
        try {
            svc_ops.indexOps().ensureIndex(new Index().on(SubNode.OWNER, Direction.ASC)
                    .on(SubNode.PROPS + "." + NodeProp.USER_NODE_ID.s(), Direction.ASC).unique().named(indexName)
                    .partial(PartialIndexFilter.of(Criteria.where(SubNode.TYPE).is(NodeType.FRIEND.s()))));
        } catch (Exception e) {
            ExUtil.error(log, "Failed to create partial unique index: " + indexName, e);
        }
    }

    /* Creates an index which will guarantee no duplicate node names can exist, for any user */
    public void createUniqueNodeNameIndex() {
        log.debug("createUniqueNodeNameIndex()");
        svc_auth.requireAdmin();
        String indexName = "unique-node-name";
        try {
            svc_ops.indexOps().ensureIndex(new Index().on(SubNode.OWNER, Direction.ASC).on(SubNode.NAME, Direction.ASC)
                    .unique().named(indexName).partial(PartialIndexFilter.of(Criteria.where(SubNode.NAME).gt(""))));
        } catch (Exception e) {
            ExUtil.error(log, "Failed to create partial unique index: " + indexName, e);
        }
    }

    public void dropAllIndexes() {
        log.debug("dropAllIndexes");
        svc_auth.requireAdmin();
        svc_ops.indexOps().dropAllIndexes();
    }

    public void dropIndex(String indexName) {
        try {
            svc_auth.requireAdmin();
            log.debug("Dropping index: " + indexName);
            svc_ops.indexOps().dropIndex(indexName);
        } catch (Exception e) {
            ExUtil.error(log, "exception in dropIndex: " + indexName, e);
        }
    }

    public void logIndexes() {
        StringBuilder sb = new StringBuilder();
        sb.append("INDEXES LIST\n:");
        List<IndexInfo> indexes = svc_ops.indexOps().getIndexInfo();

        for (IndexInfo idx : indexes) {
            List<IndexField> indexFields = idx.getIndexFields();
            sb.append("INDEX EXISTS: " + idx.getName() + "\n");

            for (IndexField idxField : indexFields) {
                sb.append("    " + idxField.toString() + "\n");
            }
        }
        log.debug(sb.toString());
    }

    /*
     * WARNING: I wote this but never tested it, nor did I ever find any examples online. Ended up not
     * needing any compound indexes (yet)
     */
    public void createPartialUniqueIndexComp2(String name, String property1, String property2) {
        svc_auth.requireAdmin();
        try {
            // Ensures unuque values for 'property' (but allows duplicates of nodes missing the property)
            svc_ops.indexOps().ensureIndex(
                    // Note: also instead of exists, something like ".gt('')" would probably work too
                    new Index().on(property1, Direction.ASC).on(property2, Direction.ASC).unique().named(name).partial(
                            PartialIndexFilter.of(Criteria.where(property1).exists(true).and(property2).exists(true))));
            log.debug("Index verified: " + name);
        } catch (Exception e) {
            ExUtil.error(log, "Failed to create partial unique index: " + name, e);
        }
    }

    /*
     * NOTE: Properties like this don't appear to be supported: "prp['ap:id'].value", but prp.apid works
     */
    public void createPartialIndex(String name, String property) {
        log.debug("Ensuring partial index named: " + name);
        svc_auth.requireAdmin();
        try {
            // Ensures unque values for 'property' (but allows duplicates of nodes missing the property)
            svc_ops.indexOps().ensureIndex(
                    // Note: also instead of exists, something like ".gt('')" would probably work too
                    new Index().on(property, Direction.ASC).named(name)
                            .partial(PartialIndexFilter.of(Criteria.where(property).exists(true))));
            log.debug("Index verified: " + name);
        } catch (Exception e) {
            ExUtil.error(log, "Failed to create partial unique index: " + name, e);
        }
    }

    /*
     * NOTE: Properties like this don't appear to be supported: "prp['ap:id'].value", but prp.apid works
     */
    public void createPartialUniqueIndex(String name, String property) {
        log.debug("Ensuring unique partial index named: " + name);
        svc_auth.requireAdmin();
        try {
            // Ensures unque values for 'property' (but allows duplicates of nodes missing the property)
            svc_ops.indexOps().ensureIndex(
                    // Note: also instead of exists, something like ".gt('')" would probably work too
                    new Index().on(property, Direction.ASC).unique().named(name)
                            .partial(PartialIndexFilter.of(Criteria.where(property).exists(true))));
            log.debug("Index verified: " + name);
        } catch (Exception e) {
            ExUtil.error(log, "Failed to create partial unique index: " + name, e);
        }
    }

    public void createPartialUniqueIndexForType(String name, String property, String type) {
        log.debug("Ensuring unique partial index (for type) named: " + name);
        svc_auth.requireAdmin();
        try {
            // Ensures unque values for 'property' (but allows duplicates of nodes missing the property)
            svc_ops.indexOps().ensureIndex(
                    // Note: also instead of exists, something like ".gt('')" would probably work too
                    new Index().on(property, Direction.ASC).unique().named(name).partial(PartialIndexFilter.of( //
                            Criteria.where(SubNode.TYPE).is(type).and(property).exists(true))));
        } catch (Exception e) {
            ExUtil.error(log, "Failed to create partial unique index: " + name, e);
        }
    }

    public void createUniqueIndex(String property) {
        log.debug("Ensuring unique index on: " + property);
        try {
            svc_auth.requireAdmin();
            svc_ops.indexOps().ensureIndex(new Index().on(property, Direction.ASC).unique());
        } catch (Exception e) {
            ExUtil.error(log, "Failed in createUniqueIndex: " + property, e);
        }
    }

    public void createIndex(String property) {
        log.debug("createIndex: " + property);
        try {
            svc_auth.requireAdmin();
            svc_ops.indexOps().ensureIndex(new Index().on(property, Direction.ASC));
        } catch (Exception e) {
            ExUtil.error(log, "Failed in createIndex: " + property, e);
        }
    }

    public void createIndex(String property, Direction dir) {
        log.debug("createIndex: " + property + " dir=" + dir);
        try {
            svc_auth.requireAdmin();
            svc_ops.indexOps().ensureIndex(new Index().on(property, dir));
        } catch (Exception e) {
            ExUtil.error(log, "Failed in createIndex: " + property + " dir=" + dir, e);
        }
    }

    /*
     * DO NOT DELETE.
     *
     * I tried to create just ONE full text index, and i get exceptions, and even if i try to build a
     * text index on a specific property I also get exceptions, so currently i am having to resort to
     * using only the createTextIndexes() below which does the 'onAllFields' option which DOES work for
     * some readonly
     */
    // public void createUniqueTextIndex(Class<?> clazz,
    // String property) {
    // requireAdmin(session);
    //
    // TextIndexDefinition textIndex = new
    // TextIndexDefinitionBuilder().onField(property).build();
    //
    // /* If mongo will not allow dupliate checks of a text index, i can simply take
    // a HASH of the
    // content text, and enforce that's unique
    // and while i'm at it secondarily use it as a corruption check.
    //
    // DBObject dbo = textIndex.getIndexOptions();
    // dbo.put("unique", true);
    // dbo.put("dropDups", true);
    //
    // opsw.indexOps(clazz).ensureIndex(textIndex);
    // }

    public void createTextIndexes() {
        log.debug("creatingText Indexes.");
        svc_auth.requireAdmin();
        try {
            // Using 'none' as default language allows `stop words` to be indexed, which are words usually
            // not searched for like "and, of, the, about, over" etc, however if you index without stop words
            // that also means searching for these basic words in the content fails. But if you do index them
            // (by using "none" here) then the index will be larger.
            TextIndexDefinition textIndex = new TextIndexDefinitionBuilder().withDefaultLanguage("none")//
                    .onField(SubNode.CONTENT) //
                    .onField(SubNode.TAGS) //
                    .build();
            // TextIndexDefinition textIndex = new TextIndexDefinitionBuilder().onAllFields().build();

            svc_ops.indexOps().ensureIndex(textIndex);
            log.debug("createTextIndex successful.");
        } catch (Exception e) {
            log.debug("createTextIndex failed.");
        }
    }

    public void dropCollection() {
        svc_auth.requireAdmin();
        svc_ops.dropCollection();
    }

    /*
     * Matches all children at a path which are at exactly one level deeper into the tree than path.
     *
     * In other words path '/abc/def' is a child of '/abc/' and is considered a direct child, whereas
     * '/abc/def/ghi' is a level deeper and NOT considered a direct child of '/abc'
     */
    public String regexChildren(String path) {
        path = XString.stripIfEndsWith(path, "/");
        return "^" + Pattern.quote(path) + "\\/[^\\/]+$";
    }

    public Criteria subGraphCriteria(String path) {
        return Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexSubGraph(path));
    }

    public Criteria childrenCriteria(String path) {
        return Criteria.where(SubNode.PATH).regex(svc_mongoUtil.regexChildren(path));
    }

    /*
     * Matches all children under path regardless of tree depth. In other words, this matches the entire
     * subgraph under path.
     *
     * In other words path '/abc/def' is a child of '/abc/' and is considered a match and ALSO
     * '/abc/def/ghi' which is a level deeper and is also considered a match
     */
    public String regexSubGraph(String path) {
        path = XString.stripIfEndsWith(path, "/");
        return "^" + Pattern.quote(path) + "\\/.+$";
    }

    public String regexSubGraphAndRoot(String path) {
        path = XString.stripIfEndsWith(path, "/");
        return "^" + Pattern.quote(path) + "(\\/.+)?$";
    }

    public boolean isChildOf(SubNode parent, SubNode child) {
        return child.getParentPath().equals(parent.getPath());
    }

    public void createPublicNodes() {
        log.debug("creating Public Nodes");
        Val<Boolean> created = new Val<>(Boolean.FALSE);
        SubNode publicNode =
                svc_snUtil.ensureNodeExists(NodePath.ROOT_PATH, NodePath.PUBLIC, "Public", null, true, null, created);
        if (created.getVal()) {
            svc_acl.addPrivilege(null, publicNode, PrincipalName.PUBLIC.s(), null,
                    Arrays.asList(PrivilegeType.READ.s()), null);
        }
        created = new Val<>(Boolean.FALSE);
        // create home node (admin owned node named 'home').
        svc_snUtil.ensureNodeExists(NodePath.PENDING_PATH, null, "Pending Edits", null, true, null, created);
        created = new Val<>(Boolean.FALSE);
        // create admin home node
        SubNode publicHome = svc_snUtil.ensureNodeExists(NodePath.ROOT_PATH + "/" + NodePath.PUBLIC, "home",
                "Public Home", null, true, null, created);
        // make node public
        svc_acl.addPrivilege(null, publicHome, PrincipalName.PUBLIC.s(), null, Arrays.asList(PrivilegeType.READ.s()),
                null);
        publicHome.set(NodeProp.UNPUBLISHED, true);
        log.debug("Public Home Node exists at id: " + publicHome.getId() + " path=" + publicHome.getPath());
    }

    public LinkedList<SubNode> asList(Iterable<SubNode> iterable) {
        LinkedList<SubNode> list = new LinkedList<>();
        if (iterable != null) {
            iterable.forEach(list::add);
        }
        return list;
    }
}
