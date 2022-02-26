package quanta.mongo;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Random;
import java.util.StringTokenizer;
import java.util.regex.Pattern;
import org.apache.commons.codec.digest.DigestUtils;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexField;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.data.mongodb.core.index.TextIndexDefinition;
import org.springframework.data.mongodb.core.index.TextIndexDefinition.TextIndexDefinitionBuilder;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import quanta.actpub.APConst;
import quanta.config.AppProp;
import quanta.config.NodeName;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.instrument.PerfMon;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.FediverseName;
import quanta.mongo.model.SubNode;
import quanta.request.SignupRequest;
import quanta.service.AclService;
import quanta.util.Const;
import quanta.util.Convert;
import quanta.util.ExUtil;
import quanta.util.ImageSize;
import quanta.util.ImageUtil;
import quanta.util.ThreadLocals;
import quanta.util.Val;
import quanta.util.XString;

/**
 * Verious utilities related to MongoDB persistence
 */
@Component
public class MongoUtil extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(MongoUtil.class);

	@Autowired
	private AppProp prop;

	private static HashSet<String> testAccountNames = new HashSet<>();
	private static final Random rand = new Random();

	public static SubNode allUsersRootNode = null;

	/*
	 * removed 'r' and 'p' since those are 'root' and 'pending' (see setPendingPath), and we need very
	 * performant way to translate from /r/p to /r path and vice verse
	 */
	static final String PATH_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnoqstuvwxyz";

	/*
	 * The set of nodes in here MUST be known to be from an UNFILTERED and COMPLETE SubGraph query or
	 * else this WILL result in DATA LOSS!
	 * 
	 * Note: rootNode will not be included in 'nodes'.
	 * 
	 * Most places we do a call like this: Iterable<SubNode> results = read.getSubGraph(ms, node, null,
	 * 0); We will be better off to filterOutOrphans from the returned list before processing it.
	 *
	 */
	public LinkedList<SubNode> filterOutOrphans(MongoSession ms, SubNode rootNode, Iterable<SubNode> nodes) {
		LinkedList<SubNode> ret = new LinkedList<>();

		// log.debug("Removing Orphans.");
		HashSet<String> paths = new HashSet<>();

		// this just helps us avoide redundant delete attempts
		HashSet<String> pathsRemoved = new HashSet<>();

		// log.debug("ROOT PTH: " + rootNode.getPath() + " content: " + rootNode.getContent());
		paths.add(rootNode.getPath());

		// Add all the paths
		for (SubNode node : nodes) {
			// log.debug("PTH: " + node.getPath() + " content: " + node.getContent());
			paths.add(node.getPath());
		}

		// now identify all nodes that don't have a parent in the list
		for (SubNode node : nodes) {
			String parentPath = node.getParentPath();

			// if parentPath not in paths this is an orphan
			if (!paths.contains(parentPath)) {
				// log.debug("ORPHAN: " + parentPath);

				// if we haven't alread seen this parent path and deleted under it.
				if (!pathsRemoved.contains(parentPath)) {
					pathsRemoved.add(parentPath);

					// Since we know this parent doesn't exist we can delete all nodes that fall under it
					// which would remove ALL siblings that are also orphans. Using this kind of pattern:
					// ${parantPath}/* (that is, we append a slash and then find anything starting with that)
					delete.deleteUnderPath(ms, parentPath);
					// NOTE: we can also go ahead and DELETE these orphans as found (from the DB)
				}
			}
			// otherwise add to our output results.
			else {
				ret.add(node);
			}
		}
		return ret;
	}

	public void validateParent(SubNode node, Document dbObj) {
		// log.debug("validateParent of node: " + node.getIdStr());

		// If this node is on a 'pending path' (user has never clicked 'save' to save it), then we always
		// need to set it's parent to NULL or else it will be visible in queries we don't want to see it.
		if (ok(node.getPath()) && node.getPath().startsWith(NodePath.PENDING_PATH + "/")) {
			// log.debug("path was pending, so parent set to null");
			if (ok(dbObj)) {
				dbObj.put(SubNode.PARENT, null);
			}
			node.setParent(null);
			return;
		}

		boolean updateParent = false;

		// if we have no parent at all need to update
		if (no(node.getParent())) {
			// log.debug("updating parent first time.");
			updateParent = true;
		}
		// Otherwise check parent for correctness
		else {
			// log.debug("checking existing parent");
			SubNode parent = read.getNode(auth.getAdminSession(), node.getParent());

			// if we didn't find parent or it's path is not a match then update parent.
			if (!ok(parent) || !parent.getPath().equals(node.getParentPath())) {
				// log.debug("path was invalid, will be udated.");
				updateParent = true;
			} else {
				// log.debug("path matched ok");
			}
		}

		if (updateParent) {
			SubNode parent = read.findNodeByPath(node.getParentPath(), true);
			if (!ok(parent)) {
				// log.debug("Updating of parent id failed. Not able to find parent: " + node.getParentPath());
				// throw exception if parent not found? No, we want to allow the save
			} else {
				// log.debug("Setting parent to id=" + parent.getIdStr());
				if (ok(dbObj)) {
					dbObj.put(SubNode.PARENT, parent.getId());
				}
				node.setParent(parent.getId());
			}
		}
	}

	/**
	 * This find method should wrap ALL queries so that we can run our code inside this NodeIterable
	 * wrapper which will detect any query results that reference objects cached in memory and point to
	 * the in-memory copy of the object during iterating.
	 * 
	 * NOTE: All security checks are done external to this method.
	 */
	public NodeIterable find(Query q) {
		Iterable<SubNode> iter = ops.find(q, SubNode.class);
		if (no(iter)) {
			return null;
		}
		return new NodeIterable(iter);
	}

	/**
	 * Runs the mongo 'findOne' but if it finds a node that's already in memory we return the memory
	 * object.
	 * 
	 * NOTE: All security checks are done external to this method.
	 */
	public SubNode findOne(Query q) {
		SubNode node = ops.findOne(q, SubNode.class);
		return nodeOrDirtyNode(node);
	}

	/**
	 * Runs the mongo 'findById' but if it finds a node that's already in memory we return the memory
	 * object.
	 * 
	 * NOTE: All security checks are done external to this method.
	 */
	@PerfMon
	public SubNode findById(ObjectId objId) {
		if (no(objId))
			return null;

		SubNode node = ThreadLocals.getCachedNode(objId.toHexString());
		if (no(node)) {
			// NOTE: For AOP Instrumentation we have to call thru the bean proxy ref, not 'this'
			node = mongoUtil.ops_findById(objId);
		}
		return nodeOrDirtyNode(node);
	}

	@PerfMon
	public SubNode ops_findById(ObjectId objId) {
		return ops.findById(objId, SubNode.class);
	}


	public SubNode findByIdNoCache(ObjectId objId) {
		return ops.findById(objId, SubNode.class);
	}

	/*
	 * Takes a path like "/a/b/" OR "/a/b" and finds any random longer path that's not currently used.
	 * Note that since we don't require to end with "/" this function can be extending an existing leaf
	 * name, or if the path does end with "/", then it has the effect of finding a new leaf from
	 * scratch.
	 * 
	 * If node is non-null we allow that node to have the path, but only that node, and if so we accept
	 * that existing path as ok and valid.
	 */
	@PerfMon
	public String findAvailablePath(String path) {
		// log.debug("findAvailablePath In: " + path);

		/*
		 * If the path we want doesn't exist at all we can use it, so check that case first, but only if we
		 * don't have a path ending with slash because that means we KNOW we need to always find a new child
		 * regardless of any existing ones
		 */
		if (!path.endsWith("/")) {
			Query q = new Query();
			q.addCriteria(Criteria.where(SubNode.PATH).is(path));
			if (!ops.exists(q, SubNode.class)) {
				return path;
			}
		}

		int tries = 0;
		while (true) {
			/*
			 * Append one random char to path. Statistically if we keep adding characters it becomes
			 * exponentially more likely we find an unused path.
			 */
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

			Query q = new Query();
			q.addCriteria(Criteria.where(SubNode.PATH).is(path));

			if (!ops.exists(q, SubNode.class)) {
				return path;
			}
			tries++;
		}
	}

	public SubNode nodeOrDirtyNode(SubNode node) {
		if (no(node)) {
			return null;
		}

		SubNode dirty = ThreadLocals.getDirtyNodes().get(node.getId());
		if (ok(dirty)) {
			return dirty;
		}

		return node;
	}

	/*
	 * We create these users just so there's an easy way to start doing multi-user testing (sharing
	 * nodes from user to user, etc) without first having to manually register users.
	 */
	public void createTestAccounts() {
		/*
		 * The testUserAccounts is a comma delimited list of user accounts where each user account is a
		 * colon-delimited list like username:password:email.
		 */
		final List<String> testUserAccountsList = XString.tokenize(prop.getTestUserAccounts(), ",", true);
		if (no(testUserAccountsList)) {
			return;
		}

		arun.run(ms -> {
			for (String accountInfo : testUserAccountsList) {
				log.debug("Verifying test Account: " + accountInfo);

				final List<String> accountInfoList = XString.tokenize(accountInfo, ":", true);
				if (no(accountInfoList) || accountInfoList.size() != 3) {
					log.debug("Invalid User Info substring: " + accountInfo);
					continue;
				}

				String userName = accountInfoList.get(0);

				SubNode ownerNode = read.getUserNodeByUserName(ms, userName);
				if (no(ownerNode)) {
					log.debug("userName not found: " + userName + ". Account will be created.");
					SignupRequest signupReq = new SignupRequest();
					signupReq.setUserName(userName);
					signupReq.setPassword(accountInfoList.get(1));
					signupReq.setEmail(accountInfoList.get(2));

					user.signup(signupReq, true);
				} else {
					log.debug("account exists: " + userName);
				}

				/*
				 * keep track of these names, because some API methods need to know if a given account is a test
				 * account
				 */
				testAccountNames.add(userName);
			}
			return null;
		});
	}

	public static boolean isTestAccountName(String userName) {
		return testAccountNames.contains(userName);
	}

	/*
	 * Make node either start with /r/p/ or ensure that it does NOT start with /r/p
	 * 
	 * 'p' means pending, and indicates user has not yet saved a new node they're currently editing, and
	 * if they cancel the node gets orphaned and eventually cleaned up by the system automatically.
	 */
	public void setPendingPath(SubNode node, boolean pending) {
		String pendingPath = NodePath.PENDING_PATH + "/";
		String rootPath = "/" + NodePath.ROOT + "/";

		// ensure node starts with /r/p
		if (pending && !node.getPath().startsWith(pendingPath)) {
			node.setPath(node.getPath().replace(rootPath, pendingPath));
		}
		// ensure node starts with /r and not /r/p
		else if (!pending && node.getPath().startsWith(pendingPath)) {
			// get pendingPath out of the path, first
			String path = node.getPath().replace(pendingPath, rootPath);
			path = findAvailablePath(path);
			node.setPath(path);
		}
	}

	/* Root path will start with '/' and then contain no other slashes */
	public boolean isRootPath(String path) {
		return path.startsWith("/") && path.substring(1).indexOf("/") == -1;
	}

	public Iterable<SubNode> findAll(MongoSession ms) {
		auth.requireAdmin(ms);
		update.saveSession(ms);
		return ops.findAll(SubNode.class);
	}

	public String getHashOfPassword(String password) {
		if (no(password))
			return null;
		return DigestUtils.sha256Hex(password).substring(0, 20);
	}

	public void convertDb(MongoSession ms) {
		// processAllNodes(session);
	}

	public void processAllNodes(MongoSession ms) {
		// Val<Long> nodesProcessed = new Val<Long>(0L);

		// Query query = new Query();
		// Criteria criteria = Criteria.where(SubNode.FIELD_ACL).ne(null);
		// query.addCriteria(criteria);

		// saveSession(session);
		// Iterable<SubNode> iter = find(query);

		// iter.forEach((node) -> {
		// nodesProcessed.setVal(nodesProcessed.getVal() + 1);
		// if (nodesProcessed.getVal() % 1000 == 0) {
		// log.debug("reSave count: " + nodesProcessed.getVal());
		// }

		// // /*
		// // * NOTE: MongoEventListener#onBeforeSave runs in here, which is where some
		// of
		// // * the workload is done that pertains ot this reSave process
		// // */
		// save(session, node, true, false);
		// });
	}

	/* Returns true if there were actually some encryption keys removed */
	public boolean removeAllEncryptionKeys(SubNode node) {
		HashMap<String, AccessControl> aclMap = node.getAc();
		if (no(aclMap)) {
			return false;
		}

		Val<Boolean> keysRemoved = new Val<>(false);
		aclMap.forEach((String key, AccessControl ac) -> {
			if (ok(ac.getKey())) {
				ac.setKey(null);
				keysRemoved.setVal(true);
			}
		});

		return keysRemoved.getVal();
	}

	public boolean isImageAttached(SubNode node) {
		String mime = node.getStr(NodeProp.BIN_MIME.s());
		return ImageUtil.isImageMime(mime);
	}

	public ImageSize getImageSize(SubNode node) {
		return Convert.getImageSize(node);
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

	public void rebuildIndexes(MongoSession ms) {
		dropAllIndexes(ms);
		createAllIndexes(ms);
	}

	// DO NOT DELETE:
	// Leaving this here for future reference for any DB-conversions.
	// This code was for removing dupliate apids and renaming a property
	public void preprocessDatabase(MongoSession ms) {
		// NO LONGER NEEDED.
		// This was a one time conversion to get the DB updated to the newer shorter path parts.
		// shortenPathParts(session);
	}

	public void processAccounts(MongoSession ms) {
		// Query to pull all user accounts
		Iterable<SubNode> accountNodes = read.findSubNodesByType(ms, MongoUtil.allUsersRootNode, NodeType.ACCOUNT.s());

		for (SubNode acctNode : accountNodes) {
			acctNode.set(NodeProp.USER_PREF_MAIN_PANEL_COLS.s(), 6);

			if (ThreadLocals.getDirtyNodeCount() > 200) {
				update.saveSession(ms);
			}
		}
	}

	/*
	 * This process finds all nodes that are remote-outbox loaded items (i.e. have an 'apid' prop), and
	 * for any that have Public sharing set the sharing on it to RDRW
	 * 
	 * This code is being kept as an example, but is no longer itself needed.
	 */
	public void fixSharing(MongoSession ms) {
		log.debug("Processing fixSharing");
		Iterable<SubNode> nodes = ops.findAll(SubNode.class);
		int counter = 0;

		for (SubNode node : nodes) {
			// essentially this converts any 'rd' to 'rdrw', or if 'rdrw' already then nothing is done.
			if (ok(node.getStr(NodeProp.ACT_PUB_ID)) && AclService.isPublic(ms, node)) {
				acl.makePublicAppendable(ms, node);
			}

			if (ThreadLocals.getDirtyNodeCount() > 200) {
				update.saveSession(ms);
			}

			if (++counter % 2000 == 0) {
				log.debug("fixShare: " + String.valueOf(counter));
			}
		}

		log.debug("fixSharing completed.");
	}

	/*
	 * todo-1: need to make the system capable of doing this logic during a "Full Maintenance"
	 * operation, like right after a DB compaction etc. Also the current code just updates path ONLY if
	 * it's currently null rather than what maintenance would do which is additionally look up the
	 * parent to verify the path IS indeed the correct parent.
	 */
	public void setParentNodes(MongoSession ms) {
		log.debug("Processing setParentNodes");
		Iterable<SubNode> nodes = ops.findAll(SubNode.class);
		int counter = 0;

		for (SubNode node : nodes) {

			// If this node is on a 'pending path' (user has never clicked 'save' to save it), then we always
			// need to set it's parent to NULL or else it will be visible in queries we don't want to see it.
			if (ok(node.getPath()) && node.getPath().startsWith(NodePath.PENDING_PATH + "/") && ok(node.getParent())) {
				node.setParent(null);
				continue;
			}

			// this is what the MongoListener does....
			mongoUtil.validateParent(node, null);

			if (ThreadLocals.getDirtyNodeCount() > 200) {
				update.saveSession(ms);
			}

			if (++counter % 1000 == 0) {
				log.debug("SPN: " + String.valueOf(counter));
			}
		}

		log.debug("setParentNodes completed.");
	}

	// Alters all paths parts that are over 10 characters long, on all nodes
	public void shortenPathParts(MongoSession ms) {
		int lenLimit = 10;
		Iterable<SubNode> nodes = ops.findAll(SubNode.class);
		HashMap<String, Integer> set = new HashMap<>();
		int idx = 0;

		for (SubNode node : nodes) {
			StringTokenizer t = new StringTokenizer(node.getPath(), "/", false);

			while (t.hasMoreTokens()) {
				String part = t.nextToken().trim();
				if (part.length() < lenLimit)
					continue;

				if (no(set.get(part))) {
					Integer x = idx++;
					set.put(part, x);
				}
			}
		}

		nodes = ops.findAll(SubNode.class);
		int maxPathLen = 0;

		for (SubNode node : nodes) {
			StringTokenizer t = new StringTokenizer(node.getPath(), "/", true);
			StringBuilder fullPath = new StringBuilder();

			while (t.hasMoreTokens()) {
				String part = t.nextToken().trim();

				// if delimiter, or short parths, just take them as is
				if (part.length() < lenLimit) {
					fullPath.append(part);
				}
				// if path part find it's unique integer, and insert
				else {
					Integer partIdx = set.get(part);

					// if the database changed underneath it we just take that as another new path part
					if (no(partIdx)) {
						partIdx = idx++;
						set.put(part, partIdx);
					}
					fullPath.append(String.valueOf(partIdx));
				}
			}

			// log.debug("fullPath: " + fullPath);
			if (fullPath.length() > maxPathLen) {
				maxPathLen = fullPath.length();
			}
			node.setPath(fullPath.toString());
			ops.save(node);
		}
		log.debug("PATH PROCESSING DONE: maxPathLen=" + maxPathLen);
	}

	public void createAllIndexes(MongoSession ms) {
		preprocessDatabase(ms);
		log.debug("checking all indexes.");

		// DO NOT DELETE. This is able to check contstraint volations.
		// read.dumpByPropertyMatch(NodeProp.USER.s(), "adam");

		log.debug("Creating FediverseName unique index.");
		ops.indexOps(FediverseName.class).ensureIndex(new Index().on(FediverseName.FIELD_NAME, Direction.ASC).unique());

		createUniqueIndex(ms, SubNode.class, SubNode.PATH);

		// Other indexes that *could* be added but we don't, just as a performance enhancer is
		// Unique node names: Key = node.owner+node.name (or just node.name for admin)
		// Unique Friends: Key = node.owner+node.friendId? (meaning only ONE Friend type node per user
		// account)

		// dropIndex(session, SubNode.class, "unique-apid");
		createPartialUniqueIndex(ms, "unique-apid", SubNode.class, SubNode.PROPS + "." + NodeProp.ACT_PUB_ID.s());

		createPartialUniqueIndexForType(ms, "unique-user-acct", SubNode.class, SubNode.PROPS + "." + NodeProp.USER.s(),
				NodeType.ACCOUNT.s());

		/*
		 * DO NOT DELETE: This is a good example of how to cleanup the DB of all constraint violations prior
		 * to adding some new constraint. And this one was for making sure the "UniqueFriends" Index could
		 * be built ok. You can't create such an index until violations of it are already removed.
		 */
		// delete.removeFriendConstraintViolations(ms);

		createUniqueFriendsIndex(ms);
		createUniqueNodeNameIndex(ms);

		// I had done this temporarily to fix a constraint violation
		// Leaving for now.
		// dropIndex(ms, SubNode.class, "unique-friends");
		// dropIndex(ms, SubNode.class, "unique-node-name");

		/*
		 * NOTE: Every non-admin owned noded must have only names that are prefixed with "UserName--" of the
		 * user. That is, prefixed by their username followed by two dashes
		 */
		createIndex(ms, SubNode.class, SubNode.NAME);
		createIndex(ms, SubNode.class, SubNode.TYPE);

		createIndex(ms, SubNode.class, SubNode.OWNER);
		createIndex(ms, SubNode.class, SubNode.PARENT);
		createIndex(ms, SubNode.class, SubNode.ORDINAL);

		// This blows up in PROD because nodes shared with too many people exceed the size allowed for an
		// index field.
		// createIndex(ms, SubNode.class, SubNode.AC); // <---Not sure this will work (AC is an Object with
		// random properties)

		createIndex(ms, SubNode.class, SubNode.MODIFY_TIME, Direction.DESC);
		createIndex(ms, SubNode.class, SubNode.CREATE_TIME, Direction.DESC);
		createTextIndexes(ms, SubNode.class);

		logIndexes(ms, SubNode.class);

		log.debug("finished checking all indexes.");
	}

	/*
	 * Creates an index which will guarantee no duplicate friends can be created for a given user. Note
	 * this one index also makes it impossible to have the same user both blocked and followed becasue
	 * those are both saved as FRIEND nodes on the tree and therefore would violate this constraint
	 * which is exactly what we want.
	 */
	public void createUniqueFriendsIndex(MongoSession ms) {
		log.debug("Creating unique friends index.");
		auth.requireAdmin(ms);
		update.saveSession(ms);
		String indexName = "unique-friends";

		try {
			ops.indexOps(SubNode.class).ensureIndex(//
					new Index().on(SubNode.OWNER, Direction.ASC) //
							.on(SubNode.PROPS + "." + NodeProp.USER_NODE_ID.s(), Direction.ASC) //
							.unique() //
							.named(indexName) //
							.partial(PartialIndexFilter.of(Criteria.where(SubNode.TYPE).is(NodeType.FRIEND.s()))));
		} catch (Exception e) {
			ExUtil.error(log, "Failed to create partial unique index: " + indexName, e);
		}
	}

	/* Creates an index which will guarantee no duplicate node names can exist, for any user */
	public void createUniqueNodeNameIndex(MongoSession ms) {
		log.debug("createUniqueNodeNameIndex()");
		auth.requireAdmin(ms);
		update.saveSession(ms);
		String indexName = "unique-node-name";

		try {
			ops.indexOps(SubNode.class).ensureIndex(//
					new Index().on(SubNode.OWNER, Direction.ASC) //
							.on(SubNode.NAME, Direction.ASC) //
							.unique() //
							.named(indexName) //
							.partial(PartialIndexFilter.of(Criteria.where(SubNode.NAME).gt(""))));
		} catch (Exception e) {
			ExUtil.error(log, "Failed to create partial unique index: " + indexName, e);
		}
	}

	public void dropAllIndexes(MongoSession ms) {
		auth.requireAdmin(ms);
		update.saveSession(ms);
		ops.indexOps(SubNode.class).dropAllIndexes();
	}

	public void dropIndex(MongoSession ms, Class<?> clazz, String indexName) {
		try {
			auth.requireAdmin(ms);
			log.debug("Dropping index: " + indexName);
			update.saveSession(ms);
			ops.indexOps(clazz).dropIndex(indexName);
		} catch (Exception e) {
			ExUtil.error(log, "exception in dropIndex: " + indexName, e);
		}
	}

	public void logIndexes(MongoSession ms, Class<?> clazz) {
		StringBuilder sb = new StringBuilder();
		update.saveSession(ms);
		sb.append("INDEXES LIST\n:");
		List<IndexInfo> indexes = ops.indexOps(clazz).getIndexInfo();
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
	public void createPartialUniqueIndexComp2(MongoSession ms, String name, Class<?> clazz, String property1, String property2) {
		auth.requireAdmin(ms);
		update.saveSession(ms);

		try {
			// Ensures unuque values for 'property' (but allows duplicates of nodes missing the property)
			ops.indexOps(clazz).ensureIndex(//
					new Index().on(property1, Direction.ASC) //
							.on(property2, Direction.ASC) //
							.unique() //
							.named(name) //
							// Note: also instead of exists, something like ".gt('')" would probably work too
							.partial(PartialIndexFilter.of(Criteria.where(property1).exists(true).and(property2).exists(true))));
			log.debug("Index verified: " + name);
		} catch (Exception e) {
			ExUtil.error(log, "Failed to create partial unique index: " + name, e);
		}
	}

	/*
	 * NOTE: Properties like this don't appear to be supported: "prp['ap:id'].value", but prp.apid
	 * works,
	 */
	public void createPartialUniqueIndex(MongoSession ms, String name, Class<?> clazz, String property) {
		log.debug("Ensuring unique partial index named: " + name);
		auth.requireAdmin(ms);
		update.saveSession(ms);

		try {
			// Ensures unque values for 'property' (but allows duplicates of nodes missing the property)
			ops.indexOps(clazz).ensureIndex(//
					new Index().on(property, Direction.ASC) //
							.unique() //
							.named(name) //
							// Note: also instead of exists, something like ".gt('')" would probably work too
							.partial(PartialIndexFilter.of(Criteria.where(property).exists(true))));
			log.debug("Index verified: " + name);
		} catch (Exception e) {
			ExUtil.error(log, "Failed to create partial unique index: " + name, e);
		}
	}

	public void createPartialUniqueIndexForType(MongoSession ms, String name, Class<?> clazz, String property, String type) {
		log.debug("Ensuring unique partial index (for type) named: " + name);
		auth.requireAdmin(ms);
		update.saveSession(ms);

		try {
			// Ensures unque values for 'property' (but allows duplicates of nodes missing the property)
			ops.indexOps(clazz).ensureIndex(//
					new Index().on(property, Direction.ASC) //
							.unique() //
							.named(name) //
							// Note: also instead of exists, something like ".gt('')" would probably work too
							.partial(PartialIndexFilter.of(//
									Criteria.where(SubNode.TYPE).is(type) //
											.and(property).exists(true))));
		} catch (Exception e) {
			ExUtil.error(log, "Failed to create partial unique index: " + name, e);
		}
	}

	public void createUniqueIndex(MongoSession ms, Class<?> clazz, String property) {
		log.debug("Ensuring unique index on: " + property);
		try {
			auth.requireAdmin(ms);
			update.saveSession(ms);
			ops.indexOps(clazz).ensureIndex(new Index().on(property, Direction.ASC).unique());
		} catch (Exception e) {
			ExUtil.error(log, "Failed in createUniqueIndex: " + property, e);
		}
	}

	public void createIndex(MongoSession ms, Class<?> clazz, String property) {
		log.debug("createIndex: " + property);
		try {
			auth.requireAdmin(ms);
			update.saveSession(ms);
			ops.indexOps(clazz).ensureIndex(new Index().on(property, Direction.ASC));
		} catch (Exception e) {
			ExUtil.error(log, "Failed in createIndex: " + property, e);
		}
	}

	public void createIndex(MongoSession ms, Class<?> clazz, String property, Direction dir) {
		log.debug("createIndex: " + property + " dir=" + dir);
		try {
			auth.requireAdmin(ms);
			update.saveSession(ms);
			ops.indexOps(clazz).ensureIndex(new Index().on(property, dir));
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
	// public void createUniqueTextIndex(MongoSession session, Class<?> clazz,
	// String property) {
	// requireAdmin(session);
	//
	// TextIndexDefinition textIndex = new
	// TextIndexDefinitionBuilder().onField(property).build();
	//
	// /* If mongo will not allow dupliate checks of a text index, i can simply take
	// a HASH of the
	// content text, and enforce that's unique
	// * and while i'm at it secondarily use it as a corruption check.
	// */
	// /* todo-2: haven't yet run my test case that verifies duplicate tree paths
	// are indeed
	// rejected */
	// DBObject dbo = textIndex.getIndexOptions();
	// dbo.put("unique", true);
	// dbo.put("dropDups", true);
	//
	// ops.indexOps(clazz).ensureIndex(textIndex);
	// }

	public void createTextIndexes(MongoSession ms, Class<?> clazz) {
		log.debug("creatingText Indexes.");
		auth.requireAdmin(ms);

		try {
			TextIndexDefinition textIndex = new TextIndexDefinitionBuilder()//
					// note: Switching BACK to "all fields" because of how Mastodon mangles hashtags like this:
					// "#<span>tag</span> making the only place we can find "#tag" as an actual string be inside
					// the properties array attached to each node.
					.onAllFields()

					// .onField(SubNode.CONTENT) //
					// .onField(SubNode.TAGS) //
					.build();

			update.saveSession(ms);
			ops.indexOps(clazz).ensureIndex(textIndex);
			log.debug("createTextIndex successful.");
		} catch (Exception e) {
			log.debug("createTextIndex failed.");
		}
	}

	public void dropCollection(MongoSession ms, Class<?> clazz) {
		auth.requireAdmin(ms);
		ops.dropCollection(clazz);
	}

	/*
	 * Matches all children at a path which are at exactly one level deeper into the tree than path.
	 * 
	 * In other words path '/abc/def' is a child of '/abc/' and is considered a direct child, whereas
	 * '/abc/def/ghi' is a level deeper and NOT considered a direct child of '/abc'
	 */
	public String regexDirectChildrenOfPath(String path) {
		path = XString.stripIfEndsWith(path, "/");

		// NOTES:
		// - The leftmost caret (^) matches path to first part of the string.
		// - The caret inside the ([]) means "not" containing the '/' char.
		// - \\/ is basically just '/' (escaped properly)
		// - The '*' means we match the "not /" condition one or more times.

		// legacy version (asterisk ouside group)
		return "^" + Pattern.quote(path) + "\\/([^\\/])*$";

		// This version also works (node the '*' location), but testing didn't show any performance
		// difference
		// return "^" + Pattern.quote(path) + "\\/([^\\/]*)$";
	}

	/*
	 * Matches all children under path regardless of tree depth. In other words, this matches the entire
	 * subgraph under path.
	 * 
	 * In other words path '/abc/def' is a child of '/abc/' and is considered a match and ALSO
	 * '/abc/def/ghi' which is a level deeper and is also considered a match
	 */
	public String regexRecursiveChildrenOfPath(String path) {
		path = XString.stripIfEndsWith(path, "/");

		// Based on this page:
		// https://docs.mongodb.com/manual/reference/operator/query/regex/#index-use
		// It looks like this might be the best performance here:
		return "^" + Pattern.quote(path) + "\\/";

		// Legacy implementation
		// return "^" + Pattern.quote(path) + "\\/(.+)$";
	}

	@PerfMon(category = "mongoUtil")
	public SubNode createUser(MongoSession ms, String user, String email, String password, boolean automated) {
		SubNode userNode = read.getUserNodeByUserName(ms, user);
		if (ok(userNode)) {
			throw new RuntimeException("User already existed: " + user);
		}

		// if (PrincipalName.ADMIN.s().equals(user)) {
		// throw new RuntimeEx("createUser should not be called fror admin
		// user.");
		// }

		auth.requireAdmin(ms);
		String newUserNodePath = NodePath.ROOT_OF_ALL_USERS + "/?";
		// todo-2: is user validated here (no invalid characters, etc. and invalid
		// flowpaths tested?)

		userNode = create.createNode(ms, newUserNodePath, NodeType.ACCOUNT.s());
		ObjectId id = new ObjectId();
		userNode.setId(id);
		userNode.setOwner(id);
		userNode.set(NodeProp.USER.s(), user);
		userNode.set(NodeProp.EMAIL.s(), email);
		userNode.set(NodeProp.PWD_HASH.s(), getHashOfPassword(password));
		userNode.set(NodeProp.USER_PREF_EDIT_MODE.s(), false);
		userNode.set(NodeProp.USER_PREF_RSS_HEADINGS_ONLY.s(), true);
		userNode.set(NodeProp.BIN_TOTAL.s(), 0);
		userNode.set(NodeProp.LAST_LOGIN_TIME.s(), 0);
		userNode.set(NodeProp.BIN_QUOTA.s(), Const.DEFAULT_USER_QUOTA);

		userNode.setContent("### Account: " + user);
		userNode.touch();

		if (!automated) {
			userNode.set(NodeProp.SIGNUP_PENDING.s(), true);
		}

		update.save(ms, userNode);
		return userNode;
	}

	/*
	 * Initialize admin user account credentials into repository if not yet done. This should only get
	 * triggered the first time the repository is created, the first time the app is started.
	 * 
	 * The admin node is also the repository root node, so it owns all other nodes, by the definition of
	 * they way security is inheritive.
	 */
	public void createAdminUser(MongoSession ms) {
		String adminUser = prop.getMongoAdminUserName();

		SubNode adminNode = read.getUserNodeByUserName(ms, adminUser);
		if (no(adminNode)) {
			adminNode = snUtil.ensureNodeExists(ms, "/", NodePath.ROOT, null, "Root", NodeType.REPO_ROOT.s(), true, null, null);

			adminNode.set(NodeProp.USER.s(), PrincipalName.ADMIN.s());
			adminNode.set(NodeProp.USER_PREF_EDIT_MODE.s(), false);
			adminNode.set(NodeProp.USER_PREF_RSS_HEADINGS_ONLY.s(), true);
			update.save(ms, adminNode);

			/*
			 * If we just created this user we know the session object here won't have the adminNode id in it
			 * yet and it needs to for all subsequent operations.
			 */
			ms.setUserNodeId(adminNode.getId());
		}

		allUsersRootNode = snUtil.ensureNodeExists(ms, "/" + NodePath.ROOT, NodePath.USER, null, "Users", null, true, null, null);
		createPublicNodes(ms);
	}

	public void createPublicNodes(MongoSession ms) {
		log.debug("creating Public Nodes");
		Val<Boolean> created = new Val<>(Boolean.FALSE);
		SubNode publicNode =
				snUtil.ensureNodeExists(ms, "/" + NodePath.ROOT, NodePath.PUBLIC, null, "Public", null, true, null, created);

		if (created.getVal()) {
			acl.addPrivilege(ms, null, publicNode, PrincipalName.PUBLIC.s(), Arrays.asList(PrivilegeType.READ.s()), null);
		}

		created = new Val<>(Boolean.FALSE);

		// create home node (admin owned node named 'home').
		SubNode publicHome = snUtil.ensureNodeExists(ms, "/" + NodePath.ROOT + "/" + NodePath.PUBLIC, NodeName.HOME,
				NodeName.HOME, "Public Home", null, true, null, created);

		// make node public
		acl.addPrivilege(ms, null, publicHome, PrincipalName.PUBLIC.s(), Arrays.asList(PrivilegeType.READ.s()), null);

		log.debug("Public Home Node exists at id: " + publicHome.getId() + " path=" + publicHome.getPath());
	}
}
