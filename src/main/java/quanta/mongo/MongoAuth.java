package quanta.mongo;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import javax.annotation.PostConstruct;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import quanta.actpub.ActPubService;
import quanta.config.NodeName;
import quanta.config.NodePath;
import quanta.exception.NodeAuthFailedException;
import quanta.exception.base.RuntimeEx;
import quanta.model.AccessControlInfo;
import quanta.model.PrivilegeInfo;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.SubNode;
import quanta.util.ThreadLocals;
import quanta.util.XString;


/**
 * Service for checking authorization for access to nodes. Checks what users are accessing what
 * nodes and checks their privileges againts the ACL on the Nodes.
 */
@Lazy
@Component
public class MongoAuth {
	private static final Logger log = LoggerFactory.getLogger(MongoAuth.class);

	@Autowired
	@Lazy
	protected MongoTemplate ops;

	@Autowired
	@Lazy
	protected ActPubService apub;

	@Autowired
	@Lazy
	protected MongoUtil mongoUtil;

	@Autowired
	@Lazy
	protected MongoAuth auth;

	@Autowired
	@Lazy
	protected MongoUpdate update;

	@Autowired
	@Lazy
	protected MongoRead read;

	private static final boolean verbose = false;

	// in order for non-spring beans (namely just SubNode.java) to access this we cheat by using this
	// static.
	public static MongoAuth inst;

	private static final Object adminSessionLck = new Object();
	private static MongoSession adminSession;

	private static final Object anonSessionLck = new Object();
	private static MongoSession anonSession;

	private static final HashMap<String, SubNode> userNodesById = new HashMap<>();

	@PostConstruct
	public void postConstruct() {
		inst = this;
	}

	public MongoSession getAdminSession() {
		if (ok(adminSession)) {
			return adminSession;
		}

		synchronized (adminSessionLck) {
			if (no(adminSession)) {
				SubNode root = read.getDbRoot();
				adminSession = new MongoSession(PrincipalName.ADMIN.s(), no(root) ? null : root.getId());
			}
			return adminSession;
		}
	}

	public MongoSession getAnonSession() {
		if (ok(anonSession)) {
			return anonSession;
		}

		synchronized (anonSessionLck) {
			if (no(anonSession)) {
				anonSession = new MongoSession(PrincipalName.ANON.s(), null);
			}
			return anonSession;
		}
	}

	public void populateUserNamesInAcl(MongoSession ms, SubNode node) {
		// iterate all acls on the node
		List<AccessControlInfo> acList = getAclEntries(ms, node);
		if (ok(acList)) {
			for (AccessControlInfo info : acList) {

				// get user account node for this sharing entry
				String userNodeId = info.getPrincipalNodeId();
				if (ok(userNodeId)) {
					info.setPrincipalName(getAccountPropById(ms, userNodeId, NodeProp.USER.s()));
				}
			}
		}
	}

	public String getAccountPropById(MongoSession ms, String accountId, String prop) {
		// special case of a public share
		if (PrincipalName.PUBLIC.s().equals(accountId)
				&& (prop.equals(NodeProp.DISPLAY_NAME.s()) || prop.equals(NodeProp.USER.s()))) {
			return PrincipalName.PUBLIC.s();
		}

		String propVal = null;
		SubNode accntNode = null;

		// try to get the node from the cache of nodes
		synchronized (userNodesById) {
			accntNode = userNodesById.get(accountId);
		}

		// if we found the node get property from it to return.
		if (ok(accntNode)) {
			propVal = accntNode.getStr(prop);
		}
		// else we have to lookup the node from the DB, and then cache it if found
		else {
			accntNode = read.getNode(ms, accountId);
			if (ok(accntNode)) {
				propVal = accntNode.getStr(prop);
				synchronized (userNodesById) {
					userNodesById.put(accountId, accntNode);
				}
			}
		}

		return propVal;
	}

	/*
	 * Returns a list of all user names that are shared to on this node, including "public" if any are
	 * public.
	 */
	public List<String> getUsersSharedTo(MongoSession ms, SubNode node) {
		List<String> userNames = null;

		List<AccessControlInfo> acList = getAclEntries(ms, node);
		if (ok(acList)) {
			for (AccessControlInfo info : acList) {
				String userNodeId = info.getPrincipalNodeId();
				String name = null;

				if (PrincipalName.PUBLIC.s().equals(userNodeId)) {
					name = PrincipalName.PUBLIC.s();
				} //
				else if (ok(userNodeId)) {
					SubNode accountNode = read.getNode(ms, userNodeId);
					if (ok(accountNode)) {
						name = accountNode.getStr(NodeProp.USER);
					}
				}

				if (ok(name)) {
					// lazy create the list
					if (no(userNames)) {
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
	 * there's an explicit share to the parent which is redundant in terms of sharing auth, but is
	 * necessary and desiret for User Feeds and social media queries to work. Also we be sure to remove
	 * any share to 'child' user that may be in the parent Acl, because that would represent 'child' not
	 * sharing to himselv which is never done.
	 * 
	 * session should be null, or else an existing admin session.
	 */
	public void setDefaultReplyAcl(MongoSession ms, SubNode parent, SubNode child) {
		if (no(parent) || no(child))
			return;

		if (no(ms)) {
			ms = getAdminSession();
		}

		HashMap<String, AccessControl> ac = parent.getAc();
		if (no(ac)) {
			ac = new HashMap<>();
		} else {
			ac = (HashMap<String, AccessControl>) ac.clone();
			ac.remove(child.getOwner().toHexString());
		}

		/*
		 * Special case of replying to (appending under) a FRIEND-type node is always to make this a private
		 * message to the user that friend node represents
		 */
		if (parent.getType().equals(NodeType.FRIEND.s())) {
			// get user prop from node
			String userName = parent.getStr(NodeProp.USER.s());

			// if we have a userProp, find the account node for the user
			if (ok(userName)) {
				SubNode accountNode = read.getUserNodeByUserName(ms, userName);
				if (ok(accountNode)) {
					ac.put(accountNode.getIdStr(), new AccessControl(null, "rd,wr"));
				}
			}
		}
		/*
		 * otherwise if not a FRIEND node we just share to the owner of the parent node
		 */
		else {
			ac.put(parent.getOwner().toHexString(), new AccessControl(null, "rd,wr"));
		}
		child.setAc(ac);
	}

	public boolean isAllowedUserName(String userName) {
		userName = userName.trim();
		return !userName.equalsIgnoreCase(PrincipalName.ADMIN.s()) && //
				!userName.equalsIgnoreCase(PrincipalName.PUBLIC.s()) && //
				!userName.equalsIgnoreCase(PrincipalName.ANON.s());
	}

	public void ownerAuth(MongoSession ms, SubNode node) {
		if (no(ms)) {
			throw new RuntimeEx("null session passed to ownerAuth.");
		}

		if (no(node)) {
			throw new RuntimeEx("Auth Failed. Node did not exist.");
		}

		if (ms.isAdmin()) {
			return;
		}

		if (no(ms.getUserNodeId())) {
			throw new RuntimeException("session has no userNode: " + XString.prettyPrint(ms));
		}

		if (!ms.getUserNodeId().equals(node.getOwner())) {
			log.error("Unable to save Node (expected ownerId " + ms.getUserNodeId().toHexString() + "): "
					+ XString.prettyPrint(node));
			throw new NodeAuthFailedException();
		}
	}

	public void requireAdmin(MongoSession ms) {
		if (!ms.isAdmin())
			throw new RuntimeEx("auth fail");
	}

	public void ownerAuthByThread(SubNode node) {
		ownerAuth(ThreadLocals.getMongoSession(), node);
	}

	public void authForChildNodeCreate(MongoSession ms, SubNode node) {
		String apId = node.getStr(NodeProp.ACT_PUB_ID);
		if (no(apId)) {
			auth(ms, node, PrivilegeType.WRITE);
		}
	}

	public void auth(MongoSession ms, SubNode node, PrivilegeType... privs) {
		// during server init no auth is required.
		if (no(node) || !MongoRepository.fullInit) {
			return;
		}
		if (verbose)
			log.trace("auth: " + node.getPath());

		if (ms.isAdmin()) {
			if (verbose)
				log.trace("you are admin. auth success.");
			return; // admin can do anything. skip auth
		}

		auth(ms, node, Arrays.asList(privs));
	}

	/*
	 * The way know a node is an account node is that it is its id matches its' owner. Self owned node.
	 * This is because the very definition of the 'owner' on any given node is the ID of the user's root
	 * node of the user who owns it
	 */
	public boolean isAnAccountNode(MongoSession ms, SubNode node) {
		return node.getIdStr().equals(node.getOwner().toHexString());
	}

	/* Returns true if this user on this session has privType access to 'node' */
	public void auth(MongoSession ms, SubNode node, List<PrivilegeType> priv) {
		// during server init no auth is required.
		if (no(node) || !MongoRepository.fullInit) {
			return;
		}

		// admin has full power over all nodes
		if (ms.isAdmin()) {
			if (verbose)
				log.trace("auth granted. you're admin.");
			return;
		}

		if (verbose)
			log.trace("auth path " + node.getPath() + " for " + ms.getUserName());

		/* Special case if this node is named 'home' it is readable by anyone */
		if (ok(node) && NodeName.HOME.equals(node.getName()) && priv.size() == 1 && priv.get(0).name().equals("READ")) {
			return;
		}

		if (no(priv) || priv.size() == 0) {
			throw new RuntimeEx("privileges not specified.");
		}

		if (no(node.getOwner())) {
			throw new RuntimeEx("node had no owner: " + node.getPath());
		}

		// if this session user is the owner of this node, then they have full power
		if (ok(ms.getUserNodeId()) && ms.getUserNodeId().equals(node.getOwner())) {
			if (verbose)
				log.trace("allow: user " + ms.getUserName() + " owns node. accountId: " + node.getOwner().toHexString());
			return;
		}

		// Find any ancestor that has priv shared to this user.
		if (ancestorAuth(ms, node, priv)) {
			log.trace("ancestor auth success.");
			return;
		}

		log.trace("Unauthorized attempt at node id=" + node.getId() + " path=" + node.getPath());
		throw new NodeAuthFailedException();
	}

	/*
	 * Returns true if the user in 'session' has 'priv' access to node.
	 */
	private boolean ancestorAuth(MongoSession ms, SubNode node, List<PrivilegeType> privs) {
		if (ms.isAdmin())
			return true;
		if (verbose)
			log.trace("ancestorAuth: path=" + node.getPath());

		/* get the non-null sessionUserNodeId if not anonymous user */
		String sessionUserNodeId = ok(ms.getUserNodeId()) ? ms.getUserNodeId().toHexString() : null;
		ObjectId sessId = ok(ms.getUserNodeId()) ? ms.getUserNodeId() : null;

		// scan up the tree until we find a node that allows access
		while (ok(node)) {
			// if this session user is the owner of this node, then they have full power
			if (ok(sessId) && sessId.equals(node.getOwner())) {
				if (verbose)
					log.trace("auth success. node is owned.");
				return true;
			}

			if (nodeAuth(node, sessionUserNodeId, privs)) {
				if (verbose)
					log.trace("nodeAuth success");
				return true;
			}

			node = read.getParent(ms, node, false);
			if (ok(node)) {
				if (verbose)
					log.trace("parent path=" + node.getPath());
			}
		}
		return false;
	}

	/*
	 * NOTE: It is the normal flow that we expect sessionUserNodeId to be null for any anonymous
	 * requests and this is fine because we are basically going to only be pulling 'public' acl to
	 * check, and this is by design.
	 */
	public boolean nodeAuth(SubNode node, String sessionUserNodeId, List<PrivilegeType> privs) {
		// log.debug("nodeAuth: nodeId: " + node.getIdStr());
		HashMap<String, AccessControl> acl = node.getAc();
		if (no(acl)) {
			// log.debug("no acls.");
			return false;
		}
		String allPrivs = "";

		AccessControl ac = (no(sessionUserNodeId) ? null : acl.get(sessionUserNodeId));
		String privsForUserId = ok(ac) ? ac.getPrvs() : null;
		if (ok(privsForUserId)) {
			allPrivs += privsForUserId;
			// log.debug("Privs for this user: " + privsForUserId);
		}

		/*
		 * We always add on any privileges assigned to the PUBLIC when checking privs for this user, becasue
		 * the auth equivalent is really the union of this set.
		 */
		AccessControl acPublic = acl.get(PrincipalName.PUBLIC.s());
		String privsForPublic = ok(acPublic) ? acPublic.getPrvs() : null;
		if (ok(privsForPublic)) {
			if (allPrivs.length() > 0) {
				allPrivs += ",";
			}
			allPrivs += privsForPublic;
			// log.debug("Public Privs: " + privsForPublic);
		}

		if (allPrivs.length() > 0) {
			for (PrivilegeType priv : privs) {
				// log.debug("Checking for priv: " + priv.name);
				if (allPrivs.indexOf(priv.name) == -1) {
					/* if any priv is missing we fail the auth */
					// log.debug("priv missing. failing auth.");
					return false;
				}
			}
			/* if we looped thru all privs ok, auth is successful */
			return true;
		}
		return false;
	}

	public List<AccessControlInfo> getAclEntries(MongoSession ms, SubNode node) {
		HashMap<String, AccessControl> aclMap = node.getAc();
		if (no(aclMap)) {
			return null;
		}

		/*
		 * I'd like this to not be created unless needed but that pesky lambda below needs a 'final' thing
		 * to work with.
		 */
		List<AccessControlInfo> ret = new LinkedList<>();

		aclMap.forEach((k, v) -> {
			AccessControlInfo acei = createAccessControlInfo(ms, k, v.getPrvs());
			if (ok(acei)) {
				ret.add(acei);
			}
		});
		return ret.size() == 0 ? null : ret;
	}

	public AccessControlInfo createAccessControlInfo(MongoSession ms, String principalId, String authType) {
		String displayName = null;
		String principalName = null;
		String publicKey = null;
		String avatarVer = null;

		/* If this is a share to public we don't need to lookup a user name */
		if (principalId.equalsIgnoreCase(PrincipalName.PUBLIC.s())) {
			principalName = PrincipalName.PUBLIC.s();
		}
		/* else we need the user name */
		else {
			SubNode principalNode = read.getNode(ms, principalId, false);
			if (no(principalNode)) {
				return null;
			}
			principalName = principalNode.getStr(NodeProp.USER.s());
			displayName = principalNode.getStr(NodeProp.DISPLAY_NAME.s());
			publicKey = principalNode.getStr(NodeProp.USER_PREF_PUBLIC_KEY.s());
			avatarVer = principalNode.getStr(NodeProp.BIN);
		}

		AccessControlInfo info = new AccessControlInfo(displayName, principalName, principalId, publicKey, avatarVer);
		info.addPrivilege(new PrivilegeInfo(authType));
		return info;
	}

	// ========================================================================
	// SubGraphByAclUser (query and count)
	// ========================================================================

	/*
	 * Finds all subnodes that have a share targeting the sharedToAny (account node IDs of a person
	 * being shared with), regardless of the type of share 'rd,rw'. To find public shares pass 'public'
	 * in sharedTo instead
	 */
	public Iterable<SubNode> searchSubGraphByAclUser(MongoSession ms, String pathToSearch, List<String> sharedToAny, Sort sort,
			int limit, ObjectId ownerIdMatch) {

		update.saveSession(ms);
		Query query = subGraphByAclUser_query(ms, pathToSearch, sharedToAny, ownerIdMatch);
		if (no(query))
			return null;

		if (ok(sort)) {
			query.with(sort);
		}

		query.limit(limit);
		return mongoUtil.find(query);
	}

	/*
	 * counts all subnodes that have a share targeting the sharedTo (account node ID of a person being
	 * shared with), regardless of the type of share 'rd,rw'. To find public shares pass 'public' in
	 * sharedTo instead
	 */
	public long countSubGraphByAclUser(MongoSession ms, String pathToSearch, List<String> sharedToAny, ObjectId ownerIdMatch) {
		update.saveSession(ms);
		Query query = subGraphByAclUser_query(ms, pathToSearch, sharedToAny, ownerIdMatch);
		if (no(query))
			return 0L;
		Long ret = ops.count(query, SubNode.class);
		return ret;
	}

	private Query subGraphByAclUser_query(MongoSession ms, String pathToSearch, List<String> sharedToAny, ObjectId ownerIdMatch) {
		// this will be node.getPath() to search under the node, or null for searching
		// under all user content.
		if (no(pathToSearch)) {
			pathToSearch = NodePath.ROOT_OF_ALL_USERS;
		}

		Query query = new Query();
		Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(pathToSearch));

		if (ok(sharedToAny) && sharedToAny.size() > 0) {
			List<Criteria> orCriteria = new LinkedList<>();
			for (String share : sharedToAny) {
				orCriteria.add(Criteria.where(SubNode.AC + "." + share).ne(null));
			}

			criteria = criteria
					.andOperator(new Criteria().orOperator((Criteria[]) orCriteria.toArray(new Criteria[orCriteria.size()])));
		}

		if (ok(ownerIdMatch)) {
			criteria = criteria.and(SubNode.OWNER).is(ownerIdMatch);
		}

		query.addCriteria(criteria);
		return query;
	}

	// ========================================================================
	// SubGraphByAcl (query and count)
	// ========================================================================

	/* Finds nodes that have any sharing on them at all */
	public Iterable<SubNode> searchSubGraphByAcl(MongoSession ms, int skip, String pathToSearch, ObjectId ownerIdMatch, Sort sort,
			int limit) {
		update.saveSession(ms);
		Query query = subGraphByAcl_query(ms, pathToSearch, ownerIdMatch);

		if (ok(sort)) {
			query.with(sort);
		}

		if (skip > 0) {
			query.skip(skip);
		}

		query.limit(limit);
		return mongoUtil.find(query);
	}

	/* Finds nodes that have any sharing on them at all */
	public long countSubGraphByAcl(MongoSession ms, String pathToSearch, ObjectId ownerIdMatch) {
		update.saveSession(ms);
		Query query = subGraphByAcl_query(ms, pathToSearch, ownerIdMatch);
		return ops.count(query, SubNode.class);
	}

	public Query subGraphByAcl_query(MongoSession ms, String pathToSearch, ObjectId ownerIdMatch) {
		Query query = new Query();

		if (no(pathToSearch)) {
			pathToSearch = NodePath.ROOT_OF_ALL_USERS;
		}

		/*
		 * This regex finds all that START WITH path, have some characters after path, before the end of the
		 * string. Without the trailing (.+)$ we would be including the node itself in addition to all its
		 * children.
		 */
		Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(pathToSearch)) //
				.and(SubNode.AC).ne(null);

		if (ok(ownerIdMatch)) {
			criteria = criteria.and(SubNode.OWNER).is(ownerIdMatch);
		}

		query.addCriteria(criteria);
		return query;
	}

	public HashSet<String> parseMentions(String message) {
		if (no(message))
			return null;
		HashSet<String> userNames = new HashSet<>();

		// prepare so that newlines are compatable with out tokenizing
		message = message.replace("\n", " ");
		message = message.replace("\r", " ");

		List<String> words = XString.tokenize(message, " ", true);
		if (ok(words)) {
			for (String word : words) {
				// detect the pattern @name@server.com or @name
				if (word.length() > 1 && word.startsWith("@") && StringUtils.countMatches(word, "@") <= 2) {
					word = word.substring(1);

					// This second 'startsWith' check ensures we ignore patterns that start with
					// "@@"
					if (!word.startsWith("@")) {
						userNames.add(word);
					}
				}
			}
		}
		return userNames;
	}

	/*
	 * Parses all mentions (like '@bob@server.com') in the node content text and adds them (if not
	 * existing) to the node sharing on the node, which ensures the person mentioned has visibility of
	 * this node and that it will also appear in their FEED listing
	 */
	public HashSet<String> saveMentionsToNodeACL(MongoSession ms, SubNode node) {
		HashSet<String> mentionsSet = parseMentions(node.getContent());
		if (no(mentionsSet)) {
			return null;
		}
		return saveMentionsToNodeACL(mentionsSet, ms, node);
	}

	public HashSet<String> saveMentionsToNodeACL(HashSet<String> mentionsSet, MongoSession ms, SubNode node) {
		boolean acChanged = false;
		HashMap<String, AccessControl> ac = node.getAc();

		// make sure all parsed toUserNamesSet user names are saved into the node acl */
		for (String userName : mentionsSet) {
			SubNode acctNode = read.getUserNodeByUserName(ms, userName);

			/*
			 * If this is a foreign 'mention' user name that is not imported into our system, we auto-import
			 * that user now
			 */
			if (StringUtils.countMatches(userName, "@") == 1) {
				/*
				 * todo-2: WARNING: this sets off a chain reaction of fediverse crawling!! Unless/until you invent
				 * some way to stop that (or decide you WANT a FediCrawler) then keep this commented out. Don't
				 * delete this code until you think this thru more.
				 */
				// if (no(acctNode)) {
				// acctNode = actPub.loadForeignUserByUserName(session, userName);
				// }
				apub.userEncountered(userName, false);
			}

			if (ok(acctNode)) {
				String acctNodeId = acctNode.getIdStr();
				if (no(ac) || !ac.containsKey(acctNodeId)) {
					/*
					 * Lazy create 'ac' so that the net result of this method is never to assign non null when it could
					 * be left null
					 */
					if (no(ac)) {
						ac = new HashMap<String, AccessControl>();
					}
					acChanged = true;
					ac.put(acctNodeId, new AccessControl(null, PrivilegeType.READ.s() + "," + PrivilegeType.WRITE.s()));
				}
			} else {
				log.debug("Mentioned user not found: " + userName);
			}
		}

		if (acChanged) {
			node.setAc(ac);
			update.save(ms, node);
		}
		return mentionsSet;
	}
}
