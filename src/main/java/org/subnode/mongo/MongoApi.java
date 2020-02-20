package org.subnode.mongo;

import java.io.BufferedInputStream;
import java.io.InputStream;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.StringTokenizer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.subnode.config.AppProp;
import org.subnode.config.NodeName;
import org.subnode.config.NodePrincipal;
import org.subnode.model.client.NodeProp;
import org.subnode.image.ImageSize;
import org.subnode.image.ImageUtil;
import org.subnode.model.AccessControlInfo;
import org.subnode.model.PrivilegeInfo;
import org.subnode.mongo.model.AccessControl;
import org.subnode.mongo.model.PrivilegeType;
import org.subnode.mongo.model.SubNode;
import org.subnode.mongo.model.SubNodePropVal;
import org.subnode.mongo.model.SubNodeTypes;
import org.subnode.mongo.model.UserPreferencesNode;
import org.subnode.mongo.model.types.AllSubNodeTypes;
import org.subnode.util.Convert;
import org.subnode.util.ExUtil;
import org.subnode.util.NodeAuthFailedException;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.Util;
import org.subnode.util.ValContainer;
import org.subnode.util.XString;
import com.mongodb.BasicDBObject;
import com.mongodb.DBObject;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoCursor;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.gridfs.GridFSBucket;
import com.mongodb.client.result.DeleteResult;

import org.apache.commons.io.input.AutoCloseInputStream;
import org.apache.commons.lang3.StringUtils;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexField;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.index.TextIndexDefinition;
import org.springframework.data.mongodb.core.index.TextIndexDefinition.TextIndexDefinitionBuilder;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.TextCriteria;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Component;

/**
 * NOTE: regex test site: http://reg-exp.com/
 */
@Component
public class MongoApi {
	private static final Logger log = LoggerFactory.getLogger(MongoApi.class);

	@Autowired
	private MongoAppConfig mac;

	@Autowired
	private MongoTemplate ops;

	@Autowired
	private GridFSBucket gridFsBucket;

	@Autowired
	private GridFsTemplate grid;

	@Autowired
	private SubNodeUtil apiUtil;

	@Autowired
	private AclService aclService;

	@Autowired
	private AllSubNodeTypes TYPES;

	@Autowired
	private SubNodeUtil util;

	@Autowired
	private AppProp appProp;

	private static final MongoSession adminSession = MongoSession.createFromUser(NodePrincipal.ADMIN);
	private static final MongoSession anonSession = MongoSession.createFromUser(NodePrincipal.ANONYMOUS);

	public MongoSession getAdminSession() {
		return adminSession;
	}

	public MongoSession getAnonSession() {
		return anonSession;
	}

	public boolean isAllowedUserName(String userName) {
		userName = userName.trim();
		return !userName.equalsIgnoreCase(NodePrincipal.ADMIN) && //
				!userName.equalsIgnoreCase(NodePrincipal.PUBLIC) && //
				!userName.equalsIgnoreCase(NodePrincipal.ANONYMOUS);
	}

	public void authRequireOwnerOfNode(MongoSession session, SubNode node) {
		if (node == null) {
			throw new RuntimeException("Auth Failed. Node did not exist.");
		}
		if (!session.isAdmin() && !session.getUserNode().getId().equals(node.getOwner())) {
			throw new RuntimeException("Auth Failed. Node ownership required.");
		}
	}

	public void requireAdmin(MongoSession session) {
		if (!session.isAdmin())
			throw new RuntimeException("auth fail");
	}

	public void auth(MongoSession session, SubNode node, PrivilegeType... privs) {
		auth(session, node, Arrays.asList(privs));
	}

	/* Returns true if this user on this session has privType access to 'node' */
	public void auth(MongoSession session, SubNode node, List<PrivilegeType> priv) {
		if (priv == null || priv.size() == 0) {
			throw new RuntimeException("privileges not specified.");
		}

		// admin has full power over all nodes
		if (node == null || session.isAdmin()) {
			log.trace("auth granted. you're admin.");
			return;
		}

		// log.trace("auth: id=" + node.getId().toHexString() + " Priv: " +
		// XString.prettyPrint(priv));

		if (node.getOwner() == null) {
			log.trace("auth fails. node had no owner: " + node.getPath());
			throw new RuntimeException("node had no owner: " + node.getPath());
		}

		// if this session user is the owner of this node, then they have full power
		if (!session.isAnon() && session.getUserNode().getId().equals(node.getOwner())) {
			log.trace("allow bc user owns node. accountId: " + node.getOwner().toHexString());
			return;
		}

		// Find any ancestor that has priv shared to this user.
		if (ancestorAuth(session, node, priv)) {
			log.trace("ancestor auth success.");
			return;
		}

		log.trace("    Unauthorized attempt at node id=" + node.getId() + " path=" + node.getPath());
		throw new NodeAuthFailedException();
	}

	/* NOTE: this should ONLY ever be called from 'auth()' method of this class */
	private boolean ancestorAuth(MongoSession session, SubNode node, List<PrivilegeType> privs) {

		/* get the non-null sessionUserNodeId if not anonymous user */
		String sessionUserNodeId = session.isAnon() ? null : session.getUserNode().getId().toHexString();

		String path = node.getPath();
		log.trace("ancestorAuth: path=" + path);

		StringBuilder fullPath = new StringBuilder();
		StringTokenizer t = new StringTokenizer(path, "/", false);
		boolean ret = false;
		while (t.hasMoreTokens()) {
			String pathPart = t.nextToken().trim();
			fullPath.append("/");
			fullPath.append(pathPart);

			// todo-2: remove concats and let NodeName have static finals for these full
			// paths.
			if (pathPart.equals("/" + NodeName.ROOT))
				continue;
			if (pathPart.equals("/" + NodeName.ROOT + "/" + NodeName.USER))
				continue;

			// I'm putting the caching of ACL results on hold, because this is only a
			// performance
			// enhancement and can wait.
			// Boolean knownAuthResult =
			// MongoThreadLocal.aclResults().get(buildAclThreadLocalKey(sessionUserNodeId,
			// fullPath,
			// privs));

			log.trace("Checking Auth of: " + fullPath.toString());

			SubNode tryNode = getNode(session, fullPath.toString(), false);
			if (tryNode == null) {
				throw new RuntimeException("Tree corrupt! path not found: " + fullPath.toString());
			}

			// if this session user is the owner of this node, then they have full power
			if (!session.isAnon() && session.getUserNode().getId().equals(tryNode.getOwner())) {
				log.debug("Auth successful. Found node user OWNS.");
				ret = true;
				break;
			}

			if (nodeAuth(tryNode, sessionUserNodeId, privs)) {
				log.debug("Auth successful.");
				ret = true;
				break;
			}
		}

		return ret;
	}

	/*
	 * NOTE: It is the normal flow that we expect sessionUserNodeId to be null for
	 * any anonymous requests and this is fine because we are basically going to
	 * only be pulling 'public' acl to check, and this is by design.
	 */
	public boolean nodeAuth(SubNode node, String sessionUserNodeId, List<PrivilegeType> privs) {
		HashMap<String, AccessControl> acl = node.getAc();
		if (acl == null)
			return false;
		String allPrivs = "";

		AccessControl ac = (sessionUserNodeId == null ? null : acl.get(sessionUserNodeId));
		String privsForUserId = ac != null ? ac.getPrvs() : null;
		if (privsForUserId != null) {
			allPrivs += privsForUserId;
		}

		/*
		 * We always add on any privileges assigned to the PUBLIC when checking privs
		 * for this user, becasue the auth equivalent is really the union of this set.
		 */
		AccessControl acPublic = acl.get(NodePrincipal.PUBLIC);
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
					/* if any priv is missing we fail the auth */
					return false;
				}
			}
			/* if we looped thru all privs ok, auth is successful */
			return true;
		}
		return false;
	}

	public void save(MongoSession session, SubNode node) {
		save(session, node, true, true);
	}

	public void save(MongoSession session, SubNode node, boolean updateThreadCache, boolean allowAuth) {
		if (allowAuth) {
			auth(session, node, PrivilegeType.WRITE);
		}
		// log.debug("MongoApi.save: DATA: " + XString.prettyPrint(node));
		node.setWriting(true);
		ops.save(node);

		if (updateThreadCache) {
			MongoThreadLocal.autoCleanup(session);
		}
	}

	/**
	 * Gets account name from the root node associated with whoever owns 'node'
	 */
	public String getNodeOwner(MongoSession session, SubNode node) {
		if (node.getOwner() == null) {
			throw new RuntimeException("Node has null owner: " + XString.prettyPrint(node));
		}
		SubNode userNode = getNode(session, node.getOwner());
		return userNode.getStringProp(NodeProp.USER.toString());
	}

	// This whole entire approach was a very bad idea...
	// We will be converting this to something mroe akin to DNS where a node that's
	// named, doesn't even need to
	// know it's named (decoupled)
	// public void renameNode(MongoSession session, SubNode node, String newName) {
	// auth(session, node, PrivilegeType.WRITE);

	// newName = FileTools.ensureValidFileNameChars(newName);
	// newName = newName.trim();
	// if (newName.length() == 0) {
	// throw ExUtil.newEx("No node name provided.");
	// }

	// log.debug("Renaming node: " + node.getId().toHexString());

	// int nodePathLen = node.getPath().length();
	// String newPathPrefix = node.getParentPath() + "/" + newName;

	// SubNode checkExists = getNode(session, newPathPrefix);
	// if (checkExists != null) {
	// throw ExUtil.newEx("Node already exists");
	// }

	// // change all paths of all children (recursively) to start with the new path
	// for (SubNode n : getSubGraph(session, node)) {
	// String path = n.getPath();
	// String chopPath = path.substring(nodePathLen);
	// String newPath = newPathPrefix + chopPath;
	// n.setPath(newPath);
	// n.setDisableParentCheck(true);
	// }

	// node.setPath(newPathPrefix);
	// }

	// Basically renames all nodes that don't start with '/r/d/' to start with that.
	// Work in progress. Not yet functional.
	public void softDelete(MongoSession session, SubNode node) {
		auth(session, node, PrivilegeType.WRITE);

		log.debug(
				"Soft Deleting node: " + node.getId().toHexString() + " New Path: /r/d/" + node.getPath().substring(3));

		String npath = node.getPath();
		// log.debug("DEL PATH?" + npath.substring(3));
		if (!npath.startsWith("/r/d/")) {
			if (npath.startsWith("/r/")) {
				// log.debug("New Path: /r/d/" + npath.substring(3));
				node.setPath("/r/d/" + npath.substring(3));
				node.setDisableParentCheck(true);
			}
		}

		// change all paths of all children (recursively) to start with the new path
		for (SubNode n : getSubGraph(session, node)) {
			String path = n.getPath();
			// log.debug("DEL PATH?" + path.substring(3));
			if (!path.startsWith("/r/d/")) {
				if (path.startsWith("/r/")) {
					// log.debug("New Path: /r/d/" + path.substring(3));
					n.setPath("/r/d/" + path.substring(3));
					n.setDisableParentCheck(true);
				}
			}
		}
	}

	/*
	 * todo-2: We could theoretically achieve a level of transactionality here if we
	 * were to setup a try/catch/finally block here and detect if any 'save' call
	 * fails, and if so, proceed to attempt to set all the nodes BACK to their
	 * original values. But before i start getting that 'creative' i need to
	 * research what the rest of the mongodb community thinks about this kind of
	 * thing, and research if there is a way to let Spring api, batch these.
	 * Actually this is probably already solved in some sort of BATCHING API already
	 * written.
	 * 
	 * UPDATE: I have a full and complete design for a Two-Phase commit, that
	 * actually offers rollback to any prior point in time also, which will be what
	 * i do regarding the above notes...
	 * 
	 * An enhancement here would be to have 'values' maintain the order in which the
	 * first modification was made so that there is no risk of errors like it saying
	 * you can't create a node before the parent node exists, because you created
	 * some new subgraph all in on 'commit'
	 */
	public void saveSession(MongoSession session) {
		synchronized (session) {
			if (MongoThreadLocal.getDirtyNodes() == null || MongoThreadLocal.getDirtyNodes().values() == null) {
				return;
			}
			/*
			 * check that we are allowed to write all, before we start writing any, to be
			 * more efficient 'transactionally'
			 */
			for (SubNode node : MongoThreadLocal.getDirtyNodes().values()) {
				auth(session, node, PrivilegeType.WRITE);
			}

			for (SubNode node : MongoThreadLocal.getDirtyNodes().values()) {
				save(session, node, false, false);
			}
			MongoThreadLocal.cleanAll();
		}
	}

	public UserPreferencesNode createUserPreferencesNode(MongoSession session, String path) {
		ObjectId ownerId = getOwnerNodeIdFromSession(session);
		return new UserPreferencesNode(ownerId, path, SubNodeTypes.UNSTRUCTURED);
	}

	public SubNode createNode(MongoSession session, SubNode parent, String type, Long ordinal,
			CreateNodeLocation location) {
		return createNode(session, parent, null, type, ordinal, location);
	}

	public SubNode createNode(MongoSession session, String path) {
		ObjectId ownerId = getOwnerNodeIdFromSession(session);
		SubNode node = new SubNode(ownerId, path, SubNodeTypes.UNSTRUCTURED, null);
		return node;
	}

	public SubNode createNode(MongoSession session, String path, String type, String ownerName) {
		if (type == null) {
			type = SubNodeTypes.UNSTRUCTURED;
		}
		ObjectId ownerId = getOwnerNodeIdFromSession(session);
		SubNode node = new SubNode(ownerId, path, type, null);
		return node;
	}

	public SubNode createNode(MongoSession session, String path, String type) {
		if (type == null) {
			type = SubNodeTypes.UNSTRUCTURED;
		}
		ObjectId ownerId = getOwnerNodeIdFromSession(session);
		SubNode node = new SubNode(ownerId, path, type, null);
		return node;
	}

	/*
	 * Creates a node, but does NOT persist it. If parent==null it assumes it's
	 * adding a root node. This is required, because all the nodes at the root level
	 * have no parent. That is, there is no ROOT node. Only nodes considered to be
	 * on the root.
	 * 
	 * relPath can be null if no path is known
	 */
	public SubNode createNode(MongoSession session, SubNode parent, String relPath, String type, Long ordinal,
			CreateNodeLocation location) {
		if (relPath == null) {
			/*
			 * Adding a node ending in '?' will trigger for the system to generate a leaf
			 * node automatically.
			 */
			relPath = "?";
		}

		if (type == null) {
			type = SubNodeTypes.UNSTRUCTURED;
		}

		String path = (parent == null ? "" : parent.getPath()) + "/" + relPath;

		ObjectId ownerId = getOwnerNodeIdFromSession(session);

		// for now not worried about ordinals for root nodes.
		if (parent == null) {
			ordinal = 0L;
		} else {
			ordinal = prepOrdinalForLocation(session, location, parent, ordinal);
		}

		SubNode node = new SubNode(ownerId, path, type, ordinal);
		return node;
	}

	private Long prepOrdinalForLocation(MongoSession session, CreateNodeLocation location, SubNode parent,
			Long ordinal) {
		switch (location) {
		case FIRST:
			ordinal = 0L;
			insertOrdinal(session, parent, 0L, 1L);
			saveSession(session);
			break;
		case LAST:
			ordinal = getMaxChildOrdinal(session, parent) + 1;
			parent.setMaxChildOrdinal(ordinal);
			break;
		case ORDINAL:
			insertOrdinal(session, parent, ordinal, 1L);
			saveSession(session);
			// leave ordinal same and return it.
			break;
		}

		return ordinal;
	}

	/*
	 * Shifts all child ordinals down (increments them by rangeSize), that are >=
	 * 'ordinal' to make a slot for the new ordinal positions for some new nodes to
	 * be inserted into this newly available range of unused sequential ordinal
	 * values (range of 'ordinal+1' thru 'ordinal+1+rangeSize')
	 */
	public void insertOrdinal(MongoSession session, SubNode node, long ordinal, long rangeSize) {
		long maxOrdinal = 0;

		/*
		 * todo-1: verify this is correct with getChildren querying unordered. It's
		 * probably fine, but also can we do a query here that selects only the
		 * ">= ordinal" ones to make this do the minimal size query?
		 */
		for (SubNode child : getChildren(session, node, null, null)) {
			Long childOrdinal = child.getOrdinal();
			long childOrdinalInt = childOrdinal == null ? 0L : childOrdinal.longValue();

			if (childOrdinalInt >= ordinal) {
				childOrdinalInt += rangeSize;
				child.setOrdinal(childOrdinalInt);
			}

			if (childOrdinalInt > maxOrdinal) {
				maxOrdinal = childOrdinalInt;
			}
		}

		/*
		 * even in the boundary case where there were no existing children, it's ok to
		 * set this node value to zero here
		 */
		node.setMaxChildOrdinal(maxOrdinal);
	}

	public ObjectId getOwnerNodeIdFromSession(MongoSession session) {
		ObjectId ownerId = null;

		if (session.getUserNode() != null) {
			ownerId = session.getUserNode().getOwner();
		} else {
			SubNode ownerNode = getUserNodeByUserName(adminSession, session.getUser());
			if (ownerNode == null) {
				/*
				 * slight mod to help bootstrapping when the admin doesn't initially have an
				 * ownernode until created
				 */
				if (!session.isAdmin()) {
					throw new RuntimeException("No user node found for user: " + session.getUser());
				} else
					return null;
			} else {
				ownerId = ownerNode.getOwner();
			}
		}

		if (ownerId == null) {
			throw new RuntimeException("Unable to get ownerId from the session.");
		}

		// if we return null, it indicates the owner is Admin.
		return ownerId;
	}

	public String getParentPath(SubNode node) {
		return XString.truncateAfterLast(node.getPath(), "/");
	}

	public long getChildCount(SubNode node) {
		// log.debug("MongoApi.getChildCount");

		Query query = new Query();
		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(regexDirectChildrenOfPath(node.getPath()));
		query.addCriteria(criteria);

		return ops.count(query, SubNode.class);
	}

	/*
	 * I find it odd that MongoTemplate no count for the whole collection. A query
	 * is always required? Strange oversight on their part.
	 */
	public long getNodeCount() {
		Query query = new Query();
		// Criteria criteria =
		// Criteria.where(SubNode.FIELD_PATH).regex(regexDirectChildrenOfPath(node.getPath()));
		// query.addCriteria(criteria);

		return ops.count(query, SubNode.class);
	}

	public SubNode getChildAt(MongoSession session, SubNode node, long idx) {
		auth(session, node, PrivilegeType.READ);
		Query query = new Query();
		Criteria criteria = Criteria.where(//
				SubNode.FIELD_PATH).regex(regexDirectChildrenOfPath(node.getPath()))//
				.and(SubNode.FIELD_ORDINAL).is(idx);
		query.addCriteria(criteria);

		SubNode ret = ops.findOne(query, SubNode.class);
		return ret;
	}

	public void checkParentExists(SubNode node) {
		boolean isRootPath = isRootPath(node.getPath());
		if (node.isDisableParentCheck() || isRootPath)
			return;

		String parentPath = getParentPath(node);
		if (parentPath == null || parentPath.equals("") || parentPath.equals("/"))
			return;

		// log.debug("Verifying parent path exists: " + parentPath);
		Query query = new Query();
		query.addCriteria(Criteria.where(SubNode.FIELD_PATH).is(parentPath));

		if (!ops.exists(query, SubNode.class)) {
			throw new RuntimeException("Attempted to add a node before its parent exists:" + parentPath);
		}
	}

	/* Root path will start with '/' and then contain no other slashes */
	public boolean isRootPath(String path) {
		return path.startsWith("/") && path.substring(1).indexOf("/") == -1;
	}

	/**
	 * 2: cleaning up GridFS will be done as an async thread. For now we can just
	 * let GridFS binaries data get orphaned... BUT I think it might end up being
	 * super efficient if we have the 'path' stored in the GridFS metadata so we can
	 * use a 'regex' query to delete all the binaries which is exacly like the one
	 * below for deleting the nodes themselves.
	 * 
	 */
	public void delete(MongoSession session, SubNode node) {
		authRequireOwnerOfNode(session, node);

		log.debug("Deleting under path: " + node.getPath());

		/*
		 * First delete all the children of the node by using the path, knowing all
		 * their paths 'start with' (as substring) this path. Note how efficient it is
		 * that we can delete an entire subgraph in one single operation! Nice!
		 */
		Query query = new Query();
		query.addCriteria(Criteria.where(SubNode.FIELD_PATH).regex(regexRecursiveChildrenOfPath(node.getPath())));

		DeleteResult res = ops.remove(query, SubNode.class);
		log.debug("Num of SubGraph deleted: " + res.getDeletedCount());

		/*
		 * Yes we DO have to remove the node itself separate from the remove of all it's
		 * subgraph, because in order to be perfectly safe the recursive subgraph regex
		 * MUST designate the slash AFTER the root path to be sure we get the correct
		 * node, other wise deleting /ab would also delete /abc for example. so we must
		 * have our recursive delete identify deleting "/ab" as starting with "/ab/"
		 */

		// we call clean to be sure we don't end up writing the node BACK out AFTER we
		// delete it.
		// MongoThreadLocal.cleanAll();
		node.setDeleted(true);
		ops.remove(node);
	}

	public Iterable<SubNode> findAllNodes(MongoSession session) {
		requireAdmin(session);
		return ops.findAll(SubNode.class);
	}

	public void convertDb(MongoSession session) {
		log.debug("convertDb() executing.");

		// shortenPaths(session);
		// makePasswordHashes(session);
	}

	public String getHashOfPassword(String password) {
		return Util.getHashOfString(password, 20);
	}

	public void makePasswordHashes(MongoSession session) {

		Query query = new Query();
		Criteria criteria = Criteria.where(//
				SubNode.FIELD_PATH).regex(regexDirectChildrenOfPath("/" + NodeName.ROOT + "/" + NodeName.USER)) //
				.and(SubNode.FIELD_PROPERTIES + "." + NodeProp.PWD_HASH + ".value").is(null);
		query.addCriteria(criteria);

		Iterable<SubNode> iter = ops.find(query, SubNode.class);

		iter.forEach((node) -> {
			String password = node.getStringProp(NodeProp.PASSWORD.toString());
			if (password != null) {
				log.debug("pwdHash update. userNode node: name=" + node.getStringProp(NodeProp.USER.toString()));

				node.setProp(NodeProp.PWD_HASH.toString(), getHashOfPassword(password));

				/*
				 * NOTE: MongoEventListener#onBeforeSave runs in here, which is where some of
				 * the workload is done that pertains ot this reSave process
				 */
				save(session, node, true, false);
			}
		});
	}

	public void shortenPaths(MongoSession session) {
		try {
			requireAdmin(session);
			Iterable<SubNode> iter = ops.findAll(SubNode.class);
			int[] iterCount = new int[1];
			iterCount[0] = 0;

			iter.forEach((node) -> {
				boolean save = shortenPath(node);
				if (save) {
					iterCount[0]++;
					ops.save(node);
				}
			});

		} catch (Exception e) {
			ExUtil.error(log, "dbConvert failed", e);
		}
	}

	/* Returns true if this path was shortened. */
	public boolean shortenPath(SubNode node) {
		boolean ret = false;
		String path = node.getPath();
		// log.debug("Path: " + path);
		StringBuilder newPath = new StringBuilder();
		StringTokenizer t = new StringTokenizer(path, "/", true);
		while (t.hasMoreTokens()) {
			String part = t.nextToken();
			if (part.length() >= 24) {
				part = Util.getHashOfString(part, 10);
				ret = true;
			}
			newPath.append(part);
		}
		if (ret) {
			// log.debug("New: " + newPath.toString());
			node.setPath(newPath.toString());
		}
		return ret;
	}

	public String getNodeReport() {
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
			throw ExUtil.newEx(ex);
		}

		float kb = totalJsonBytes / 1024f;
		return "Node Count: " + numDocs + "<br>Total JSON Size: " + kb + " KB";
	}

	/*
	 * Whenever we do something like reindex in a new way, we might need to
	 * reprocess every object, to generate any kind of auto-generated fields that
	 * need to be there before indexes build we call this.
	 * 
	 * For example when the path hash was introduced (i.e. SubNode.FIELD_PATH_HASH)
	 * we ran this to create all the path hashes so that a unique index could be
	 * built, because the uniqueness test would fail until we generated all the
	 * proper data, which required a modification on every node in the entire DB.
	 * 
	 * Note that MongoEventListener#onBeforeSave does execute even if all we are
	 * doing is reading nodes and then resaving them.
	 */
	// ********* DO NOT DELETE *********
	// (this is needed from time to time)
	public void reSaveAll(MongoSession session) {
		log.debug("Processing reSaveAll: Beginning Node Report: " + getNodeReport());

		// todo-0: the new AC shares are now complete on all instances, only
		// remaining conversion is to delete the ACL field itself, eventually
		// processAllNodes(session);
	}

	public void processAllNodes(MongoSession session) {
		// ValContainer<Long> nodesProcessed = new ValContainer<Long>(0L);

		// Query query = new Query();
		// Criteria criteria = Criteria.where(SubNode.FIELD_ACL).ne(null);
		// query.addCriteria(criteria);

		// Iterable<SubNode> iter = ops.find(query, SubNode.class);

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

	public UserPreferencesNode getUserPreference(MongoSession session, String path) {
		if (path.equals("/")) {
			throw new RuntimeException(
					"SubNode doesn't implement the root node. Root is implicit and never needs an actual node to represent it.");
		}

		Query query = new Query();
		query.addCriteria(Criteria.where(SubNode.FIELD_PATH).is(path));
		UserPreferencesNode ret = ops.findOne(query, UserPreferencesNode.class);
		auth(session, ret, PrivilegeType.READ);
		return ret;
	}

	public UserPreferencesNode getUserPreference(MongoSession session, ObjectId objId) {
		UserPreferencesNode ret = ops.findById(objId, UserPreferencesNode.class);
		auth(session, ret, PrivilegeType.READ);
		return ret;
	}

	/* Returns true if there were actually some encryption keys removed */
	public boolean removeAllEncryptionKeys(SubNode node) {
		HashMap<String, AccessControl> aclMap = node.getAc();
		if (aclMap == null) {
			return false;
		}

		ValContainer<Boolean> keysRemoved = new ValContainer<Boolean>(false);
		aclMap.forEach((String key, AccessControl ac) -> {
			if (ac.getKey() != null) {
				ac.setKey(null);
				keysRemoved.setVal(true);
			}
		});

		return keysRemoved.getVal();
	}

	public List<AccessControlInfo> getAclEntries(MongoSession session, SubNode node) {
		HashMap<String, AccessControl> aclMap = node.getAc();
		if (aclMap == null) {
			return null;
		}

		// I'd like this to not be created unless needed but that pesky lambda below
		// needs a 'final' thing to work with.
		final List<AccessControlInfo> ret = new LinkedList<AccessControlInfo>();

		aclMap.forEach((k, v) -> {
			AccessControlInfo acei = createAccessControlInfo(session, k, v.getPrvs());
			if (acei != null) {
				ret.add(acei);
			}
		});

		return ret.size() == 0 ? null : ret;
	}

	public AccessControlInfo createAccessControlInfo(MongoSession session, String principalId,
			String authType) {
		String principalName = null;
		String publicKey = null;

		/* If this is a share to public we don't need to lookup a user name */
		if (principalId.equalsIgnoreCase(NodePrincipal.PUBLIC)) {
			principalName = NodePrincipal.PUBLIC;
		}
		/* else we need the user name */
		else {
			SubNode principalNode = getNode(session, principalId, false);
			if (principalNode == null) {
				return null;
			}
			principalName = principalNode.getStringProp(NodeProp.USER.toString());
			publicKey = principalNode.getStringProp(NodeProp.USER_PREF_PUBLIC_KEY.toString());
		}

		AccessControlInfo info = new AccessControlInfo(principalName, principalId, publicKey);
		info.addPrivilege(new PrivilegeInfo(authType));
		return info;
	}

	public SubNode getNodeByName(MongoSession session, String name) {
		return getNodeByName(session, name, true);
	}

	public SubNode getNodeByName(MongoSession session, String name, boolean allowAuth) {
		SubNode ret = null;

		Query query = new Query();
		query.addCriteria(Criteria.where(SubNode.FIELD_NAME).is(name));
		ret = ops.findOne(query, SubNode.class);

		if (allowAuth) {
			auth(session, ret, PrivilegeType.READ);
		}
		return ret;
	}

	public SubNode getNode(MongoSession session, String path) {
		return getNode(session, path, true);
	}

	// Gets a node using any of the three naming types:
	// ID, or path (starts with slash), or name (starts with colon)
	public SubNode getNode(MongoSession session, String searchArg, boolean allowAuth) {
		if (searchArg.equals("/")) {
			throw new RuntimeException(
					"SubNode doesn't implement the root node. Root is implicit and never needs an actual node to represent it.");
		}

		SubNode ret = null;

		// Node name lookups are done by prefixing the search with a colon (:)
		if (searchArg.startsWith(":")) {
			ret = getNodeByName(session, searchArg.substring(1), allowAuth);
		}
		// If search doesn't start with a slash then it's a nodeId and not a path
		else if (!searchArg.startsWith("/")) {
			ret = getNode(session, new ObjectId(searchArg), allowAuth);
		} else {
			searchArg = XString.stripIfEndsWith(searchArg, "/");
			Query query = new Query();
			query.addCriteria(Criteria.where(SubNode.FIELD_PATH).is(searchArg));
			ret = ops.findOne(query, SubNode.class);
		}

		if (allowAuth) {
			auth(session, ret, PrivilegeType.READ);
		}
		return ret;
	}

	public SubNode getNode(MongoSession session, ObjectId objId) {
		return getNode(session, objId, true);
	}

	public SubNode getNode(MongoSession session, ObjectId objId, boolean allowAuth) {
		if (objId == null)
			return null;
		SubNode ret = ops.findById(objId, SubNode.class);
		if (allowAuth) {
			auth(session, ret, PrivilegeType.READ);
		}
		return ret;
	}

	public SubNode getParent(MongoSession session, SubNode node) {
		String path = node.getPath();
		if ("/".equals(path)) {
			return null;
		}
		String parentPath = XString.truncateAfterLast(path, "/");
		Query query = new Query();
		query.addCriteria(Criteria.where(SubNode.FIELD_PATH).is(parentPath));
		SubNode ret = ops.findOne(query, SubNode.class);
		auth(session, ret, PrivilegeType.READ);
		return ret;
	}

	public boolean isImageAttached(SubNode node) {
		String mime = node.getStringProp(NodeProp.BIN_MIME.toString());
		return ImageUtil.isImageMime(mime);
	}

	public ImageSize getImageSize(SubNode node) {
		return Convert.getImageSize(node);
	}

	public List<SubNode> getChildrenAsList(MongoSession session, SubNode node, boolean ordered, Integer limit) {
		Iterable<SubNode> iter = getChildren(session, node,
				ordered ? Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL) : null, limit);
		List<SubNode> list = new LinkedList<SubNode>();
		iter.forEach(list::add);
		return list;
	}

	public List<String> getChildrenIds(MongoSession session, SubNode node, boolean ordered, Integer limit) {
		auth(session, node, PrivilegeType.READ);

		Query query = new Query();
		if (limit != null) {
			query.limit(limit.intValue());
		}

		/*
		 * This regex finds all that START WITH "path/" and then end with some other
		 * string that does NOT contain "/", so that we know it's not at a deeper level
		 * of the tree, but is immediate children of 'node'
		 * 
		 * ^:aa:bb:([^:])*$
		 * 
		 * example: To find all DIRECT children (non-recursive) under path /aa/bb regex
		 * is ^\/aa\/bb\/([^\/])*$ (Note that in the java string the \ becomes \\
		 * below...)
		 * 
		 */
		Criteria criteria = Criteria.where(SubNode.FIELD_PATH)
				.regex(regexDirectChildrenOfPath(node == null ? "" : node.getPath()));
		if (ordered) {

			query.with(Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL));
		}
		query.addCriteria(criteria);

		Iterable<SubNode> iter = ops.find(query, SubNode.class);
		List<String> nodeIds = new LinkedList<String>();
		for (SubNode n : iter) {
			nodeIds.add(n.getId().toHexString());
		}
		return nodeIds;
	}

	/*
	 * If node is null it's path is considered empty string, and it represents the
	 * 'root' of the tree. There is no actual NODE that is root node
	 */
	public Iterable<SubNode> getChildren(MongoSession session, SubNode node, Sort sort, Integer limit) {
		auth(session, node, PrivilegeType.READ);

		Query query = new Query();
		if (limit != null) {
			query.limit(limit.intValue());
		}
		/*
		 * This regex finds all that START WITH "path/" and then end with some other
		 * string that does NOT contain "/", so that we know it's not at a deeper level
		 * of the tree, but is immediate children of 'node'
		 * 
		 * ^:aa:bb:([^:])*$
		 * 
		 * example: To find all DIRECT children (non-recursive) under path /aa/bb regex
		 * is ^\/aa\/bb\/([^\/])*$ (Note that in the java string the \ becomes \\
		 * below...)
		 * 
		 */
		Criteria criteria = Criteria.where(SubNode.FIELD_PATH)
				.regex(regexDirectChildrenOfPath(node == null ? "" : node.getPath()));

		if (sort != null) {
			query.with(sort);
		}

		query.addCriteria(criteria);

		return ops.find(query, SubNode.class);
	}

	/*
	 * All we need to do here is query for children an do a "max(ordinal)" operation
	 * on that, but digging the information off the web for how to do this appears
	 * to be something that may take a few hours so i'm skipping it for now and just
	 * doing an inverse sort on ORDER and pulling off the top one and using that for
	 * my MAX operation. AFAIK this might even be the most efficient approach. Who
	 * knows. MongoDb is stil the wild wild west of databases.
	 */
	public Long getMaxChildOrdinal(MongoSession session, SubNode node) {
		// Do not delete this commented garbage. Can be helpful to get aggregates
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
		auth(session, node, PrivilegeType.READ);

		// todo-2: research if there's a way to query for just one, rather than simply
		// callingfindOne at the end? What's best practice here?
		Query query = new Query();
		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(regexDirectChildrenOfPath(node.getPath()));
		query.with(Sort.by(Sort.Direction.DESC, SubNode.FIELD_ORDINAL));
		query.addCriteria(criteria);

		SubNode nodeFound = ops.findOne(query, SubNode.class);
		if (nodeFound == null) {
			return 0L;
		}
		return nodeFound.getOrdinal();
	}

	public SubNode getSiblingAbove(MongoSession session, SubNode node) {
		auth(session, node, PrivilegeType.READ);

		if (node.getOrdinal() == null) {
			throw new RuntimeException("can't get node above node with null ordinal.");
		}

		// todo-2: research if there's a way to query for just one, rather than simply
		// calling findOne at the end? What's best practice here?
		Query query = new Query();
		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(regexDirectChildrenOfPath(node.getParentPath()));
		query.with(Sort.by(Sort.Direction.DESC, SubNode.FIELD_ORDINAL));
		query.addCriteria(criteria);

		// leave this example. you can do a RANGE like this.
		// query.addCriteria(Criteria.where(SubNode.FIELD_ORDINAL).lt(50).gt(20));
		query.addCriteria(Criteria.where(SubNode.FIELD_ORDINAL).lt(node.getOrdinal()));

		SubNode nodeFound = ops.findOne(query, SubNode.class);
		return nodeFound;
	}

	public SubNode getSiblingBelow(MongoSession session, SubNode node) {
		auth(session, node, PrivilegeType.READ);
		if (node.getOrdinal() == null) {
			throw new RuntimeException("can't get node above node with null ordinal.");
		}

		// todo-2: research if there's a way to query for just one, rather than simply
		// calling findOne at the end? What's best practice here?
		Query query = new Query();
		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(regexDirectChildrenOfPath(node.getParentPath()));
		query.with(Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL));
		query.addCriteria(criteria);

		// leave this example. you can do a RANGE like this.
		// query.addCriteria(Criteria.where(SubNode.FIELD_ORDINAL).lt(50).gt(20));
		query.addCriteria(Criteria.where(SubNode.FIELD_ORDINAL).gt(node.getOrdinal()));

		SubNode nodeFound = ops.findOne(query, SubNode.class);
		return nodeFound;
	}

	// todo-1: There is a Query.skip() function on the Query object, that can be
	// used instead of this
	public int skip(Iterator<SubNode> iter, int count) {
		int iterCount = 0;
		for (int i = 0; i < count; i++) {
			if (!iter.hasNext()) {
				break;
			}
			iter.next();
			iterCount++;
		}
		return iterCount;
	}

	/*
	 * Gets (recursively) all nodes under 'node', by using all paths starting with
	 * the path of that node
	 */
	public Iterable<SubNode> getSubGraph(MongoSession session, SubNode node) {
		auth(session, node, PrivilegeType.READ);

		Query query = new Query();
		/*
		 * This regex finds all that START WITH path, have some characters after path,
		 * before the end of the string. Without the trailing (.+)$ we would be
		 * including the node itself in addition to all its children.
		 */
		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(regexRecursiveChildrenOfPath(node.getPath()));
		query.addCriteria(criteria);

		return ops.find(query, SubNode.class);
	}

	/**
	 * prop is optional and if non-null means we should search only that one field.
	 * 
	 * WARNING. "SubNode.prp" is a COLLECTION and therefore not searchable. Beware.
	 */
	public Iterable<SubNode> searchSubGraph(MongoSession session, SubNode node, String prop, String text,
			String sortField, int limit) {
		auth(session, node, PrivilegeType.READ);

		Query query = new Query();
		query.limit(limit);
		/*
		 * This regex finds all that START WITH path, have some characters after path,
		 * before the end of the string. Without the trailing (.+)$ we would be
		 * including the node itself in addition to all its children.
		 */
		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(regexRecursiveChildrenOfPath(node.getPath()));
		query.addCriteria(criteria);

		if (!StringUtils.isEmpty(text)) {
			// // todo-1: need to do escaping. Currently only alpha text searches will work
			// // here well, without manual escaping.
			// // the 'i' means case insensitive (remove it for case sensitive)
			// not sure which of these is best:
			// query.addCriteria(Criteria.where(prop).regex(Pattern.compile(".*" + text +
			// ".*")));
			// query.addCriteria(Criteria.where(prop).regex(".*" + text + ".*"));

			// /////
			// Quer query = Query.query(
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
			textCriteria.caseSensitive(false);
			query.addCriteria(textCriteria);
		}

		if (!StringUtils.isEmpty(sortField)) {
			query.with(Sort.by(Sort.Direction.DESC, sortField));
		}

		return ops.find(query, SubNode.class);
	}

	/*
	 * Buildsl the 'criteria' object using the kind of searching Google does where
	 * anything in quotes is considered a phrase and anything else separated by
	 * spaces are separate search terms.
	 * 
	 * TODO-1: Submit this to the Spring dev team for pull request. This should be
	 * built into spring.
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

	public void rebuildIndexes(MongoSession session) {
		dropAllIndexes(session);
		createAllIndexes(session);
	}

	public void createAllIndexes(MongoSession session) {
		try {
			// dropIndex(session, SubNode.class, SubNode.FIELD_PATH + "_1");
			dropIndex(session, SubNode.class, SubNode.FIELD_NAME + "_1");
		} catch (Exception e) {
			log.debug("no field name index found. ok. this is fine.");
		}
		log.debug("creating all indexes.");

		createUniqueIndex(session, SubNode.class, SubNode.FIELD_PATH_HASH);

		/*
		 * todo-1: A future enhancement will probably be to use the event listener to
		 * make it so that when anyone other than admin tries to set the name on a node,
		 * their username (node ID) will automatically get prefixed onto the front of it
		 * so that each user will basically have their own namespace to use for node
		 * naming uniqueness constraint.
		 */
		createIndex(session, SubNode.class, SubNode.FIELD_NAME);

		createIndex(session, SubNode.class, SubNode.FIELD_ORDINAL);
		createIndex(session, SubNode.class, SubNode.FIELD_MODIFY_TIME, Direction.DESC);
		createIndex(session, SubNode.class, SubNode.FIELD_CREATE_TIME, Direction.DESC);
		createTextIndexes(session, SubNode.class);

		logIndexes(session, SubNode.class);
	}

	public void dropAllIndexes(MongoSession session) {
		requireAdmin(session);
		ops.indexOps(SubNode.class).dropAllIndexes();
	}

	public void dropIndex(MongoSession session, Class<?> clazz, String indexName) {
		requireAdmin(session);
		log.debug("Dropping index: " + indexName);
		ops.indexOps(clazz).dropIndex(indexName);
	}

	public void logIndexes(MongoSession session, Class<?> clazz) {
		StringBuilder sb = new StringBuilder();
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

	public void createUniqueIndex(MongoSession session, Class<?> clazz, String property) {
		requireAdmin(session);
		ops.indexOps(clazz).ensureIndex(new Index().on(property, Direction.ASC).unique());
	}

	public void createIndex(MongoSession session, Class<?> clazz, String property) {
		requireAdmin(session);
		ops.indexOps(clazz).ensureIndex(new Index().on(property, Direction.ASC));
	}

	public void createIndex(MongoSession session, Class<?> clazz, String property, Direction dir) {
		requireAdmin(session);
		ops.indexOps(clazz).ensureIndex(new Index().on(property, dir));
	}

	// DO NOT DELETE.
	//
	// I tried to create just ONE full text index, and i get exceptions, and even if
	// i try to build
	// a text index
	// on a specific property I also get exceptions, to currently i am having to
	// resort to using
	// only the
	// createTextIndexes() below which does the 'onAllFields' option which DOES work
	// for some readon
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

	public void createTextIndexes(MongoSession session, Class<?> clazz) {
		requireAdmin(session);

		TextIndexDefinition textIndex = new TextIndexDefinitionBuilder().onAllFields()
				// .onField(SubNode.FIELD_PROPERTIES+"."+NodeProp.CONTENT)
				.build();

		ops.indexOps(clazz).ensureIndex(textIndex);
	}

	public void dropCollection(MongoSession session, Class<?> clazz) {
		requireAdmin(session);
		ops.dropCollection(clazz);
	}

	public void writeStream(MongoSession session, SubNode node, InputStream stream, String fileName, String mimeType,
			String propName) {
		auth(session, node, PrivilegeType.WRITE);
		if (propName == null) {
			propName = "bin";
		}

		if (fileName == null) {
			fileName = "file";
		}

		DBObject metaData = new BasicDBObject();
		metaData.put("nodeId", node.getId());

		/*
		 * Delete any existing grid data stored under this node, before saving new
		 * attachment
		 */
		deleteBinary(session, node, null);

		String id = grid.store(stream, fileName, mimeType, metaData).toString();

		/*
		 * Now save the node also since the property on it needs to point to GridFS id
		 */
		node.setProp(propName, new SubNodePropVal(id));
	}

	public void deleteBinary(MongoSession session, SubNode node, String propName) {
		auth(session, node, PrivilegeType.WRITE);
		if (propName == null) {
			propName = "bin";
		}
		String id = node.getStringProp(propName);
		if (id == null) {
			return;
			// not a problem. allow a delete when there's nothing to delete.
		}
		grid.delete(new Query(Criteria.where("_id").is(id)));
	}

	public InputStream getStream(MongoSession session, SubNode node, String propName) {
		auth(session, node, PrivilegeType.READ);
		if (propName == null) {
			propName = "bin";
		}

		return getStreamByNodeId(node.getId());
	}

	public InputStream getStreamByNodeId(ObjectId nodeId) {
		log.debug("getStreamByNodeId: " + nodeId.toString());

		com.mongodb.client.gridfs.model.GridFSFile gridFile = grid
				.findOne(new Query(Criteria.where("metadata.nodeId").is(nodeId)));
		if (gridFile == null)
			return null;

		GridFsResource gridFsResource = new GridFsResource(gridFile,
				gridFsBucket.openDownloadStream(gridFile.getObjectId()));
		try {
			return gridFsResource.getInputStream();
		} catch (Exception e) {
			throw new RuntimeException("unable to readStream", e);
		}
	}

	public AutoCloseInputStream getAutoClosingStream(MongoSession session, SubNode node, String propName) {
		return new AutoCloseInputStream(new BufferedInputStream(getStream(session, node, propName)));
	}

	public String regexDirectChildrenOfPath(String path) {
		path = XString.stripIfEndsWith(path, "/");
		return "^" + Pattern.quote(path) + "\\/([^\\/])*$";
	}

	/*
	 * todo-2: I think now that I'm including the trailing slash after path in this
	 * regex that I can remove the (.+) piece? I think i need to write some test
	 * cases just to text my regex functions!
	 * 
	 * todo-1: Also what's the 'human readable' description of what's going on here?
	 * substring or prefix? For performance we DO want this to be finding all nodes
	 * that 'start with' the path as opposed to simply 'contain' the path right? To
	 * make best use of indexes etc?
	 */
	public String regexRecursiveChildrenOfPath(String path) {
		path = XString.stripIfEndsWith(path, "/");
		return "^" + Pattern.quote(path) + "\\/(.+)$";
	}

	/*
	 * For proof-of-concept i'm storing actual password, instead of a hash of it,
	 * which is what will be done in final production code.
	 * 
	 * Also for cases as important as this we need to see if we can have a unique
	 * constratint index type capability for path of all user account nodes?
	 */
	public SubNode createUser(MongoSession session, String user, String email, String password, boolean automated) {
		if (NodePrincipal.ADMIN.equals(user)) {
			throw new RuntimeException("createUser should not be called fror admin user.");
		}

		requireAdmin(session);
		String newUserNodePath = "/" + NodeName.ROOT + "/" + NodeName.USER + "/?";
		// todo-1: is user validated here (no invalid characters, etc. and invalid
		// flowpaths tested?)

		/*
		 * todo-p1: need to create this node as if it were also renamed to 'user', so
		 * that immediately all user root nodes are addressible as "/r/usr/myName".
		 */
		SubNode userNode = createNode(session, newUserNodePath, null);
		userNode.setProp(NodeProp.USER.toString(), user);
		userNode.setProp(NodeProp.EMAIL.toString(), email);
		// userNode.setProp(NodeProp.PASSWORD, password);
		userNode.setProp(NodeProp.PWD_HASH.toString(), getHashOfPassword(password));
		userNode.setProp(NodeProp.USER_PREF_EDIT_MODE.toString(), false);

		userNode.setContent("User Account: " + user);

		if (!automated) {
			userNode.setProp(NodeProp.SIGNUP_PENDING.toString(), true);
		}

		save(session, userNode);

		/*
		 * The user root nodes are the owners of themselves.
		 * 
		 * todo-1: is there a way to avoid doing two saves in this method?
		 * 
		 * Also remember there's a bug where TWO user root nodes are getting created.
		 */
		userNode.setOwner(userNode.getId());
		save(session, userNode);

		return userNode;
	}

	public SubNode getUserNodeByUserName(MongoSession session, String user) {
		if (user == null)
			return null;
		user = user.trim();

		// For the ADMIN user their root node is considered to be the entire root of the
		// whole DB
		if (NodePrincipal.ADMIN.equalsIgnoreCase(user)) {
			return getNode(session, "/" + NodeName.ROOT);
		}

		// Other wise for ordinary users root is based off their username
		Query query = new Query();
		Criteria criteria = Criteria.where(//
				SubNode.FIELD_PATH).regex(regexDirectChildrenOfPath("/" + NodeName.ROOT + "/" + NodeName.USER))//
				.and(SubNode.FIELD_PROPERTIES + "." + NodeProp.USER + ".value").is(user);

		// todo-1: once this is proven, need to rename the existing nodes to embed
		// username in this new way
		// Criteria criteria = Criteria.where(//
		// SubNode.FIELD_PATH).regex(regexDirectChildrenOfPath("/" + NodeName.ROOT + "/"
		// + NodeName.USER + "/" + user));

		query.addCriteria(criteria);
		SubNode ret = ops.findOne(query, SubNode.class);
		auth(session, ret, PrivilegeType.READ);
		return ret;
	}

	public MongoSession login(String userName, String password) {
		// log.debug("Mongo API login: user="+userName);
		MongoSession session = MongoSession.createFromUser(NodePrincipal.ANONYMOUS);

		/*
		 * If username is null or anonymous, we assume anonymous is acceptable and
		 * return anonymous session or else we check the credentials.
		 */
		if (!NodePrincipal.ANONYMOUS.equals(userName)) {
			log.trace("looking up user node.");
			SubNode userNode = getUserNodeByUserName(getAdminSession(), userName);
			boolean success = false;

			if (userNode != null) {

				/*
				 * If logging in as ADMIN we don't expect the node to contain any password in
				 * the db, but just use the app property instead.
				 */
				// if (NodePrincipal.ADMIN.equals(userName)) {
				if (password.equals(appProp.getMongoAdminPassword())) {
					success = true;
				}
				// }
				// else it's an ordinary user so we check the password against their user node
				// else if (userNode.getStringProp(NodeProp.PASSWORD).equals(password)) {
				else if (userNode.getStringProp(NodeProp.PWD_HASH.toString()).equals(getHashOfPassword(password))) {
					success = true;
				}
			}

			if (success) {
				session.setUser(userName);
				session.setUserNode(userNode);
			} else {
				throw new RuntimeException("Login failed.");
			}
		}
		return session;
	}

	/*
	 * Initialize admin user account credentials into repository if not yet done.
	 * This should only get triggered the first time the repository is created, the
	 * first time the app is started.
	 * 
	 * The admin node is also the repository root node, so it owns all other nodes,
	 * by the definition of they way security is inheritive.
	 */
	public void createAdminUser(MongoSession session) {
		// todo-2: fix inconsistency: is admin name defined in properties file or in
		// NodePrincipal.ADMIN const ? Need to decide.
		String adminUser = appProp.getMongoAdminUserName();
		// String adminPwd = appProp.getMongoAdminPassword();

		SubNode adminNode = getUserNodeByUserName(getAdminSession(), adminUser);
		if (adminNode == null) {
			adminNode = apiUtil.ensureNodeExists(session, "/", NodeName.ROOT, "Repository Root", null, true, null,
					null);

			adminNode.setProp(NodeProp.USER.toString(), NodePrincipal.ADMIN);

			// todo-1: need to store ONLY hash of the password
			adminNode.setProp(NodeProp.USER_PREF_EDIT_MODE.toString(), false);
			save(session, adminNode);

			apiUtil.ensureNodeExists(session, "/" + NodeName.ROOT, NodeName.USER, "Root of All Users", null, true, null,
					null);
			apiUtil.ensureNodeExists(session, "/" + NodeName.ROOT, NodeName.OUTBOX, "System Email Outbox", null, true,
					null, null);
		}

		apiUtil.ensureNodeExists(session, "/" + NodeName.ROOT, "d", "Garbage Bin", null, true, null, null);

		createPublicNodes(session);
	}

	public void createPublicNodes(MongoSession session) {
		ValContainer<Boolean> created = new ValContainer<>();
		SubNode publicNode = apiUtil.ensureNodeExists(session, "/" + NodeName.ROOT, NodeName.PUBLIC, "Public", null,
				true, null, created);

		if (created.getVal()) {
			// todo-p0: need these types of strings ('rd') to be in an enum or constants
			// file.
			aclService.addPrivilege(session, publicNode, NodePrincipal.PUBLIC, Arrays.asList("rd"), null);
		}

		/* Ensure Content folder is created and synced to file system */
		// SubNodePropertyMap props = new SubNodePropertyMap();
		// props.put(TYPES.FILE_SYNC_LINK.getName(), new
		// SubNodePropVal(appProp.publicContentFolder()));
		// SubNode contentNode = apiUtil.ensureNodeExists(session, "/" + NodeName.ROOT +
		// "/" + NodeName.PUBLIC, "content",
		// null, TYPES.FILE_SYNC_ROOT.getName(), true, props, created);

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
