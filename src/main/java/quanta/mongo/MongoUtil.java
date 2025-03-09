package quanta.mongo;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Random;
import java.util.regex.Pattern;
import org.apache.commons.codec.digest.DigestUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.BulkOperations.BulkMode;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.client.Attachment;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.SubNode;
import quanta.util.Const;
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

    /**
     * Validates the given SubNode object.
     * 
     * This method performs several checks and validations on the provided node: 1. Checks if the node
     * is marked as dirty and logs a warning if it is. 2. Ensures the node has an owner. If not, throws
     * a RuntimeException. 3. Ensures nodes of type ACCOUNT or REPO_ROOT do not have any sharing. If
     * they do, throws a RuntimeException. 4. Ensures home nodes are always unpublished. 5. Fixes any
     * attachments associated with the node. 6. Verifies and sets the parent path of the node.
     * 
     * @param node the SubNode object to be validated
     * @throws RuntimeException if the node has no owner or if nodes of type ACCOUNT or REPO_ROOT have
     *         sharing
     */
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
                throw new RuntimeEx("Node of type " + node.getType() + " cannot have any sharing: " + node.getIdStr());
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
     * 
     * The reserving set is used to ensure that we know which ones a given worker thread has reserved so
     * it won't try to use it again, for a diferent node, because this can happen since our transaction
     * is not committed yet
     */
    public String findAvailablePath(String path, HashSet<String> reserved) {
        /*
         * If the path we want doesn't exist at all we can use it, so check that case first, but only if we
         * don't have a path ending with slash because that means we KNOW we need to always find a new child
         * regardless of any existing ones
         */
        if (!path.endsWith("/") && (reserved == null || !reserved.contains(path)) && pathIsAvailable(path)) {
            if (reserved != null) {
                reserved.add(path);
            }
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
            if ((reserved == null || !reserved.contains(path)) && pathIsAvailable(path)) {
                // we must proactively delete any orphaned nodes that might be existing and would be 'ressurected'
                // which would be BAD!
                long orphans = svc_mongoDelete.simpleDeleteUnderPath(path);
                if (orphans > 0) {
                    log.debug("New Path Found: " + path + " deleted " + orphans + " orphans");
                }
                if (reserved != null) {
                    reserved.add(path);
                }
                return path;
            }
            tries++;
        }
    }

    /**
     * Checks if a given path is available.
     * 
     * This method determines if the specified path is available for use by checking if the exact path
     * exists or if any node starting with the specified path followed by a "/" exists, even if it is an
     * orphaned node.
     * 
     * @param path the path to check for availability
     * @return true if the path is available, false otherwise
     */
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
            p = findAvailablePath(p, null);
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
        aclMap.forEach((String _, AccessControl ac) -> {
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
        SubNode publicNode = svc_snUtil.ensureNodeExists(NodePath.ROOT_PATH, NodePath.PUBLIC, "Public", null, null,
                true, null, created);
        if (created.getVal()) {
            svc_acl.addPrivilege(null, publicNode, PrincipalName.PUBLIC.s(), null,
                    Arrays.asList(PrivilegeType.READ.s()), null);
        }
        created = new Val<>(Boolean.FALSE);
        // create home node (admin owned node named 'home').
        svc_snUtil.ensureNodeExists(NodePath.PENDING_PATH, null, "Pending Edits", null, null, true, null, created);
        created = new Val<>(Boolean.FALSE);
        // create admin home node
        SubNode publicHome = svc_snUtil.ensureNodeExists(NodePath.ROOT_PATH + "/" + NodePath.PUBLIC, "home",
                "Public Home", null, null, true, null, created);
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
