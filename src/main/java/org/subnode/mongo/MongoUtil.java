package org.subnode.mongo;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.StringTokenizer;
import java.util.regex.Pattern;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoCursor;
import com.mongodb.client.MongoDatabase;
import org.apache.commons.codec.digest.DigestUtils;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import org.subnode.config.NodeName;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.model.client.PrincipalName;
import org.subnode.model.client.PrivilegeType;
import org.subnode.mongo.model.AccessControl;
import org.subnode.mongo.model.FediverseName;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.SignupRequest;
import org.subnode.service.ServiceBase;
import org.subnode.util.Const;
import org.subnode.util.Convert;
import org.subnode.util.ExUtil;
import org.subnode.util.ImageSize;
import org.subnode.util.ImageUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.ValContainer;
import org.subnode.util.XString;

@Component
public class MongoUtil extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(MongoUtil.class);

	private static HashSet<String> testAccountNames = new HashSet<>();

	private static SubNode systemRootNode;

	private static final Random rand = new Random();

	/*
	 * removed 'r' and 'p' since those are 'root' and 'pending' (see setPendingPath), and we need very
	 * performanc way to translate from /r/p to /r path and vice verse
	 */
	static final String PATH_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnoqstuvwxyz";

	// todo-2: need to look into bulk-ops for doing this saveSession updating
	// tips:
	// https://stackoverflow.com/questions/26657055/spring-data-mongodb-and-bulk-update
	// BulkOperations ops = template.bulkOps(BulkMode.UNORDERED, Match.class);
	// for (User user : users) {
	// Update update = new Update();
	// ...
	// ops.updateOne(query(where("id").is(user.getId())), update);
	// }
	// ops.execute();
	//

	/**
	 * This find method should wrap ALL queries to that we can run out code inside this NodeIterable
	 * wrapper which will detect any query results that reference objects cached in memory and point to
	 * the in-memory copy of the object during iterating.
	 */
	public NodeIterable find(Query query) {
		Iterable<SubNode> iter = ops.find(query, SubNode.class);
		if (iter == null) {
			return null;
		}
		return new NodeIterable(iter);
	}

	/**
	 * Runs the mongo 'findOne' but if it finds a node that's already in memory we return the memory
	 * object
	 */
	public SubNode findOne(Query query) {
		SubNode node = ops.findOne(query, SubNode.class);
		return nodeOrDirtyNode(node);
	}

	/**
	 * Runs the mongo 'findById' but if it finds a node that's already in memory we return the memory
	 * object
	 */
	public SubNode findById(ObjectId objId) {
		if (objId == null)
			return null;

		SubNode node = ThreadLocals.getCachedNode(objId.toHexString());
		if (node == null) {
			node = ops.findById(objId, SubNode.class);
		}
		return nodeOrDirtyNode(node);
	}

	/*
	 * Takes a path like "/a/b/" OR "/a/b" and finds any random longer path that's not currently used.
	 * Note that since we don't require to end with "/" this function can be extending an existing leaf
	 * name, or if the path does end with "/", then it has the effect of finding a new leaf from
	 * scratch.
	 */
	public String findAvailablePath(String path) {
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

			Query query = new Query();
			query.addCriteria(Criteria.where(SubNode.FIELD_PATH).is(path));

			if (!ops.exists(query, SubNode.class)) {
				return path;
			}
			tries++;
		}
	}

	public SubNode nodeOrDirtyNode(SubNode node) {
		if (node == null) {
			return null;
		}

		SubNode dirty = ThreadLocals.getDirtyNodes().get(node.getId());
		if (dirty != null) {
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
		final List<String> testUserAccountsList = XString.tokenize(appProp.getTestUserAccounts(), ",", true);
		if (testUserAccountsList == null) {
			return;
		}

		arun.run(ms -> {
			for (String accountInfo : testUserAccountsList) {
				log.debug("Verifying test Account: " + accountInfo);

				final List<String> accountInfoList = XString.tokenize(accountInfo, ":", true);
				if (accountInfoList == null || accountInfoList.size() != 3) {
					log.debug("Invalid User Info substring: " + accountInfo);
					continue;
				}

				String userName = accountInfoList.get(0);

				SubNode ownerNode = read.getUserNodeByUserName(ms, userName);
				if (ownerNode == null) {
					log.debug("userName not found: " + userName + ". Account will be created.");
					SignupRequest signupReq = new SignupRequest();
					signupReq.setUserName(userName);
					signupReq.setPassword(accountInfoList.get(1));
					signupReq.setEmail(accountInfoList.get(2));

					usrMgr.signup(signupReq, true);
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
		String pendingPath = NodeName.PENDING_PATH + "/";
		String rootPath = "/" + NodeName.ROOT + "/";

		// ensure node starts with /r/p
		if (pending && !node.getPath().startsWith(pendingPath)) {
			node.setPath(node.getPath().replace(rootPath, pendingPath));
		}
		// ensure node starts with /r and not /r/p
		else if (!pending && node.getPath().startsWith(pendingPath)) {
			// get 'p' out of the path, first
			String path = node.getPath().replace(pendingPath, rootPath);

			// and finally ensure we have an UNUSED (not duplicate) path
			path = util.findAvailablePath(path);
			node.setPath(path);
		}
	}

	/* Root path will start with '/' and then contain no other slashes */
	public boolean isRootPath(String path) {
		return path.startsWith("/") && path.substring(1).indexOf("/") == -1;
	}

	public Iterable<SubNode> findAllNodes(MongoSession ms) {
		auth.requireAdmin(ms);
		update.saveSession(ms);
		return ops.findAll(SubNode.class);
	}

	public String getHashOfPassword(String password) {
		if (password == null)
			return null;
		return DigestUtils.sha256Hex(password).substring(0, 20);
	}

	/*
	 * This was early code, and it not even practical in a large database. Leaving this code in place as
	 * an example of how to call databae directly without spring.
	 */
	public String getNodeReport_obsolete() {
		int numDocs = 0;
		int totalJsonBytes = 0;
		MongoDatabase database = mac.mongoClient().getDatabase(MongoAppConfig.databaseName);
		MongoCollection<Document> col = database.getCollection("nodes");

		MongoCursor<Document> cur = col.find().iterator();
		try {
			while (cur.hasNext()) {
				Document doc = cur.next();
				totalJsonBytes += doc.toJson().length();
				numDocs++;
			}
		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		}

		/*
		 * todo-2: I have a 'formatMemory' written in javascript, and need to do same here or see if there's
		 * an apachie string function for it.
		 */
		float kb = totalJsonBytes / 1024f;
		return "Node Count: " + numDocs + "<br>Total JSON Size: " + kb + " KB<br>";
	}

	public void convertDb(MongoSession ms) {
		// processAllNodes(session);
	}

	public void processAllNodes(MongoSession ms) {
		// ValContainer<Long> nodesProcessed = new ValContainer<Long>(0L);

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
		if (aclMap == null) {
			return false;
		}

		ValContainer<Boolean> keysRemoved = new ValContainer<>(false);
		aclMap.forEach((String key, AccessControl ac) -> {
			if (ac.getKey() != null) {
				ac.setKey(null);
				keysRemoved.setVal(true);
			}
		});

		return keysRemoved.getVal();
	}

	public boolean isImageAttached(SubNode node) {
		String mime = node.getStrProp(NodeProp.BIN_MIME.s());
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

				if (set.get(part) == null) {
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
					if (partIdx == null) {
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

		ops.indexOps(FediverseName.class).ensureIndex(new Index().on(FediverseName.FIELD_NAME, Direction.ASC).unique());

		createUniqueIndex(ms, SubNode.class, SubNode.FIELD_PATH);

		// Other indexes that *could* be added but we don't, just as a performance enhancer is
		// Unique node names: Key = node.owner+node.name (or just node.name for admin)
		// Unique Friends: Key = node.owner+node.friendId? (meaning only ONE Friend type node per user
		// account)

		// dropIndex(session, SubNode.class, "unique-apid");
		createPartialUniqueIndex(ms, "unique-apid", SubNode.class,
				SubNode.FIELD_PROPERTIES + "." + NodeProp.ACT_PUB_ID.s() + ".value");

		createUniqueFriendsIndex(ms);
		createUniqueNodeNameIndex(ms);

		/*
		 * NOTE: Every non-admin owned noded must have only names that are prefixed with "UserName--" of the
		 * user. That is, prefixed by their username followed by two dashes
		 */
		createIndex(ms, SubNode.class, SubNode.FIELD_NAME);
		createIndex(ms, SubNode.class, SubNode.FIELD_TYPE);

		createIndex(ms, SubNode.class, SubNode.FIELD_OWNER);
		createIndex(ms, SubNode.class, SubNode.FIELD_ORDINAL);
		createIndex(ms, SubNode.class, SubNode.FIELD_MODIFY_TIME, Direction.DESC);
		createIndex(ms, SubNode.class, SubNode.FIELD_CREATE_TIME, Direction.DESC);
		createTextIndexes(ms, SubNode.class);

		logIndexes(ms, SubNode.class);
	}

	/* Creates an index which will guarantee no duplicate friends can be 
	created. Note this one index also makes it impossible to have the same user both blocked and followed
	becasue those are both saved as FRIEND nodes on the tree and therefore would violate this constraint
	which is exactly what we want. */
	public void createUniqueFriendsIndex(MongoSession ms) {
		auth.requireAdmin(ms);
		update.saveSession(ms);
		String indexName = "unique-friends";

		try {
			ops.indexOps(SubNode.class).ensureIndex(//
					new Index().on(SubNode.FIELD_OWNER, Direction.ASC) //
							.on(SubNode.FIELD_PROPERTIES + "." + NodeProp.USER_NODE_ID.s() + ".value", Direction.ASC) //
							.unique() //
							.named(indexName) //
							.partial(PartialIndexFilter.of(Criteria.where(SubNode.FIELD_TYPE).is(NodeType.FRIEND.s()))));
		} catch (Exception e) {
			ExUtil.error(log, "Failed to create partial unique index: " + indexName, e);
		}
	}

	/* Creates an index which will guarantee no duplicate node names can exist, for any user */
	public void createUniqueNodeNameIndex(MongoSession ms) {
		auth.requireAdmin(ms);
		update.saveSession(ms);
		String indexName = "unique-node-name";

		try {
			ops.indexOps(SubNode.class).ensureIndex(//
					new Index().on(SubNode.FIELD_OWNER, Direction.ASC) //
							.on(SubNode.FIELD_NAME, Direction.ASC) //
							.unique() //
							.named(indexName) //
							.partial(PartialIndexFilter.of(Criteria.where(SubNode.FIELD_NAME).gt(""))));
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
		auth.requireAdmin(ms);
		log.debug("Dropping index: " + indexName);
		update.saveSession(ms);
		ops.indexOps(clazz).dropIndex(indexName);
	}

	public void logIndexes(MongoSession ms, Class<?> clazz) {
		StringBuilder sb = new StringBuilder();
		update.saveSession(ms);
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
	public void createPartialUniqueIndexComp2(MongoSession ms, String name, Class<?> clazz, String property1,
			String property2) {
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
		} catch (Exception e) {
			ExUtil.error(log, "Failed to create partial unique index: " + name, e);
		}
	}

	/*
	 * NOTE: Properties like this don't appear to be supported: "prp['ap:id'].value", but prp.apid.value
	 * works
	 */
	public void createPartialUniqueIndex(MongoSession ms, String name, Class<?> clazz, String property) {
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
		} catch (Exception e) {
			ExUtil.error(log, "Failed to create partial unique index: " + name, e);
		}
	}

	public void createUniqueIndex(MongoSession ms, Class<?> clazz, String property) {
		auth.requireAdmin(ms);
		update.saveSession(ms);
		ops.indexOps(clazz).ensureIndex(new Index().on(property, Direction.ASC).unique());
	}

	public void createIndex(MongoSession ms, Class<?> clazz, String property) {
		auth.requireAdmin(ms);
		update.saveSession(ms);
		ops.indexOps(clazz).ensureIndex(new Index().on(property, Direction.ASC));
	}

	public void createIndex(MongoSession ms, Class<?> clazz, String property, Direction dir) {
		auth.requireAdmin(ms);
		update.saveSession(ms);
		ops.indexOps(clazz).ensureIndex(new Index().on(property, dir));
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
		auth.requireAdmin(ms);

		TextIndexDefinition textIndex = new TextIndexDefinitionBuilder().onAllFields()
				// .onField(SubNode.FIELD_PROPERTIES+"."+NodeProp.CONTENT)
				.build();

		update.saveSession(ms);
		ops.indexOps(clazz).ensureIndex(textIndex);
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
		return "^" + Pattern.quote(path) + "\\/([^\\/])*$";
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
		return "^" + Pattern.quote(path) + "\\/.*";

		// Legacy implementation
		// return "^" + Pattern.quote(path) + "\\/(.+)$";
	}

	public SubNode createUser(MongoSession ms, String user, String email, String password, boolean automated) {
		SubNode userNode = read.getUserNodeByUserName(ms, user);
		if (userNode != null) {
			throw new RuntimeException("User already existed: " + user);
		}

		// if (PrincipalName.ADMIN.s().equals(user)) {
		// throw new RuntimeEx("createUser should not be called fror admin
		// user.");
		// }

		auth.requireAdmin(ms);
		String newUserNodePath = NodeName.ROOT_OF_ALL_USERS + "/?";
		// todo-2: is user validated here (no invalid characters, etc. and invalid
		// flowpaths tested?)

		userNode = create.createNode(ms, newUserNodePath, NodeType.ACCOUNT.s());
		ObjectId id = new ObjectId();
		userNode.setId(id);
		userNode.setOwner(id);
		userNode.setProp(NodeProp.USER.s(), user);
		userNode.setProp(NodeProp.EMAIL.s(), email);
		userNode.setProp(NodeProp.PWD_HASH.s(), getHashOfPassword(password));
		userNode.setProp(NodeProp.USER_PREF_EDIT_MODE.s(), false);
		userNode.setProp(NodeProp.USER_PREF_RSS_HEADINGS_ONLY.s(), true);
		userNode.setProp(NodeProp.BIN_TOTAL.s(), 0);
		userNode.setProp(NodeProp.LAST_LOGIN_TIME.s(), 0);
		userNode.setProp(NodeProp.BIN_QUOTA.s(), Const.DEFAULT_USER_QUOTA);

		userNode.setContent("### Account: " + user);
		userNode.touch();

		if (!automated) {
			userNode.setProp(NodeProp.SIGNUP_PENDING.s(), true);
		}

		update.save(ms, userNode);
		return userNode;
	}

	public SubNode getSystemRootNode() {
		if (systemRootNode == null) {
			systemRootNode = read.getNode(auth.getAdminSession(), "/r");
		}
		return systemRootNode;
	}

	/*
	 * Initialize admin user account credentials into repository if not yet done. This should only get
	 * triggered the first time the repository is created, the first time the app is started.
	 * 
	 * The admin node is also the repository root node, so it owns all other nodes, by the definition of
	 * they way security is inheritive.
	 */
	public void createAdminUser(MongoSession ms) {
		String adminUser = appProp.getMongoAdminUserName();

		SubNode adminNode = read.getUserNodeByUserName(ms, adminUser);
		if (adminNode == null) {
			adminNode =
					snUtil.ensureNodeExists(ms, "/", NodeName.ROOT, null, "Root", NodeType.REPO_ROOT.s(), true, null, null);

			adminNode.setProp(NodeProp.USER.s(), PrincipalName.ADMIN.s());
			adminNode.setProp(NodeProp.USER_PREF_EDIT_MODE.s(), false);
			adminNode.setProp(NodeProp.USER_PREF_RSS_HEADINGS_ONLY.s(), true);
			update.save(ms, adminNode);

			/*
			 * If we just created this user we know the session object here won't have the adminNode id in it
			 * yet and it needs to for all subsequent operations.
			 */
			ms.setUserNodeId(adminNode.getId());

			snUtil.ensureNodeExists(ms, "/" + NodeName.ROOT, NodeName.USER, null, "Users", null, true, null, null);
		}

		createPublicNodes(ms);
	}

	public void createPublicNodes(MongoSession ms) {
		log.debug("creating Public Nodes");
		ValContainer<Boolean> created = new ValContainer<>(Boolean.FALSE);
		SubNode publicNode =
				snUtil.ensureNodeExists(ms, "/" + NodeName.ROOT, NodeName.PUBLIC, null, "Public", null, true, null, created);

		if (created.getVal()) {
			acl.addPrivilege(ms, publicNode, PrincipalName.PUBLIC.s(), Arrays.asList(PrivilegeType.READ.s()), null);
		}

		created = new ValContainer<>(Boolean.FALSE);

		// create home node (admin owned node named 'home').
		SubNode publicHome = snUtil.ensureNodeExists(ms, "/" + NodeName.ROOT + "/" + NodeName.PUBLIC, NodeName.HOME,
				NodeName.HOME, "Public Home", null, true, null, created);

		// make node public
		acl.addPrivilege(ms, publicHome, PrincipalName.PUBLIC.s(), Arrays.asList(PrivilegeType.READ.s()), null);

		log.debug("Public Home Node exists at id: " + publicHome.getId() + " path=" + publicHome.getPath());

		/*
		 * create welcome page if not existing. This is the main landing page. (todo-1: document this in
		 * User Guide admin session). This node need not be public, because the system reads it, and it can
		 * be placed somewhere that users are not able to navigate directly to it, so we default it to being
		 * directly in the server root, which is a private node
		 */
		created = new ValContainer<>(Boolean.FALSE);
		SubNode publicWelcome = snUtil.ensureNodeExists(ms, "/" + NodeName.ROOT, NodeName.WELCOME, "welcome-page",
				"### Welcome Node\n\nDefault landing page content. Admin should edit this node, named 'welcome-page'", null, true,
				null, created);

		if (created.getVal()) {
			acl.addPrivilege(ms, publicWelcome, PrincipalName.PUBLIC.s(), Arrays.asList(PrivilegeType.READ.s()),
					null);
		}

		log.debug("Welcome Page Node exists at id: " + publicWelcome.getId() + " path=" + publicWelcome.getPath());

		// // ---------------------------------------------------------
		// // NOTE: Do not delete this. May need this example in the future. This is
		// // formerly the way we loaded the static
		// // site content (landing page, etc) for the app, before using the Folder
		// Synced
		// // "content" folder which we currently use.
		// // ImportZipService importZipService = (ImportZipService)
		// // SpringContextUtil.getBean(ImportZipService.class);
		// // importZipService.inputZipFileFromResource(session, "classpath:home.zip",
		// // publicNode, NodeName.HOME);
		// // ---------------------------------------------------------
		// SubNode node = getNode(session, "/" + NodeName.ROOT + "/" + NodeName.PUBLIC +
		// "/" + NodeName.HOME);
		// if (node == null) {
		// log.debug("Public node didn't exist. Creating.");
		// node = getNode(session, "/" + NodeName.ROOT + "/" + NodeName.PUBLIC + "/" +
		// NodeName.HOME);
		// if (node == null) {
		// log.debug("Error reading node that was just imported.");
		// } else {
		// long childCount = getChildCount(node);
		// log.debug("Verified Home Node has " + childCount + " children.");
		// }
		// } else {
		// long childCount = getChildCount(node);
		// log.debug("Home node already existed with " + childCount + " children");
		// }
	}
}
