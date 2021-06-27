package org.subnode.mongo;

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
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import org.subnode.actpub.ActPubService;
import org.subnode.config.NodeName;
import org.subnode.exception.NodeAuthFailedException;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.AccessControlInfo;
import org.subnode.model.PrivilegeInfo;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.model.client.PrincipalName;
import org.subnode.model.client.PrivilegeType;
import org.subnode.mongo.model.AccessControl;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;

@Component
public class MongoAuth {
	private static final Logger log = LoggerFactory.getLogger(MongoAuth.class);
	private static final boolean verbose = false;

	// in order for non-spring beans (namely just SubNode.java) to access this we cheat by using this
	// static.
	public static MongoAuth inst;

	@Autowired
	private MongoTemplate ops;

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoUpdate update;

	@Autowired
	private MongoUtil util;

	@Autowired
	private ActPubService actPub;

	private static final MongoSession adminSession = new MongoSession(PrincipalName.ADMIN.s());
	private static final MongoSession anonSession = new MongoSession(PrincipalName.ANON.s());

	private static final HashMap<String, String> userNamesByAccountId = new HashMap<>();
	private static final HashMap<String, String> displayNamesByAccountId = new HashMap<>();

	@PostConstruct
	public void postConstruct() {
		inst = this;
	}

	// todo-0: look for places where the asAdminThread version should be used.
	public MongoSession getAdminSession() {
		if (adminSession.getUserNodeId() == null) {
			adminSession.setUserNodeId(read.getDbRoot().getId());
		}
		return adminSession;
	}

	public MongoSession asAdminThread() {
		if (adminSession.getUserNodeId() == null) {
			adminSession.setUserNodeId(read.getDbRoot().getId());
		}
		ThreadLocals.setMongoSession(adminSession);
		return adminSession;
	}

	public MongoSession getAnonSession() {
		return anonSession;
	}

	public void populateUserNamesInAcl(MongoSession session, SubNode node) {
		// iterate all acls on the node
		List<AccessControlInfo> acList = getAclEntries(session, node);
		if (acList != null) {
			for (AccessControlInfo info : acList) {

				// get user account node for this sharing entry
				String userNodeId = info.getPrincipalNodeId();
				if (userNodeId != null) {
					info.setPrincipalName(getUserNameFromAccountNodeId(session, userNodeId));
				}
			}
		}
	}

	/* todo-1: need to unify getDisplayNameFrom... and getUserNameFrom... below (next two functions) */
	public String getDisplayNameFromAccountNodeId(MongoSession session, String accountId) {

		// special case of a public share
		if (PrincipalName.PUBLIC.s().equals(accountId)) {
			return PrincipalName.PUBLIC.s();
		}

		// if the userName is cached get it from the cache.
		synchronized (displayNamesByAccountId) {
			String displayName = displayNamesByAccountId.get(accountId);
			if (displayName != null) {
				return displayName;
			}
		}

		// if userName not found in cache we read the node to get the userName from it.
		SubNode accountNode = read.getNode(session, accountId);
		if (accountNode != null) {
			synchronized (displayNamesByAccountId) {
				// get the userName from the node, then put it in 'info' and cache it also.
				String displayName = accountNode.getStrProp(NodeProp.DISPLAY_NAME);

				displayNamesByAccountId.put(accountId, displayName);
				return displayName;
			}
		}
		return null;
	}

	public String getUserNameFromAccountNodeId(MongoSession session, String accountId) {

		// special case of a public share
		if (PrincipalName.PUBLIC.s().equals(accountId)) {
			return PrincipalName.PUBLIC.s();
		}

		// if the userName is cached get it from the cache.
		synchronized (userNamesByAccountId) {
			String userName = userNamesByAccountId.get(accountId);
			if (userName != null) {
				return userName;
			}
		}

		// if userName not found in cache we read the node to get the userName from it.
		SubNode accountNode = read.getNode(session, accountId);
		if (accountNode != null) {
			synchronized (userNamesByAccountId) {
				// get the userName from the node, then put it in 'info' and cache it also.
				String userName = accountNode.getStrProp(NodeProp.USER);

				userNamesByAccountId.put(accountId, userName);
				return userName;
			}
		}
		return null;
	}

	/*
	 * Returns a list of all user names that are shared to on this node, including "public" if any are
	 * public.
	 */
	public List<String> getUsersSharedTo(MongoSession session, SubNode node) {
		List<String> userNames = null;

		List<AccessControlInfo> acList = getAclEntries(session, node);
		if (acList != null) {
			for (AccessControlInfo info : acList) {
				String userNodeId = info.getPrincipalNodeId();
				String name = null;

				if (PrincipalName.PUBLIC.s().equals(userNodeId)) {
					name = PrincipalName.PUBLIC.s();
				} //
				else if (userNodeId != null) {
					SubNode accountNode = read.getNode(session, userNodeId);
					if (accountNode != null) {
						name = accountNode.getStrProp(NodeProp.USER);
					}
				}

				if (name != null) {
					// lazy create the list
					if (userNames == null) {
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
	public void setDefaultReplyAcl(MongoSession session, SubNode parent, SubNode child) {
		if (parent == null || child == null)
			return;

		if (session == null) {
			session = getAdminSession();
		}

		HashMap<String, AccessControl> ac = parent.getAc();
		if (ac == null) {
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
			String userName = parent.getStrProp(NodeProp.USER.s());

			// if we have a userProp, find the account node for the user
			if (userName != null) {
				SubNode accountNode = read.getUserNodeByUserName(session, userName);
				if (accountNode != null) {
					ac.put(accountNode.getId().toHexString(), new AccessControl(null, "rd,wr"));
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

	public void ownerAuth(MongoSession session, SubNode node) {
		if (node == null) {
			throw new RuntimeEx("Auth Failed. Node did not exist.");
		}

		if (session.isAdmin()) {
			return;
		}

		if (session.getUserNodeId() == null) {
			throw new RuntimeException("session has no userNode: " + XString.prettyPrint(session));
		}

		if (!session.getUserNodeId().equals(node.getOwner())) {
			throw new NodeAuthFailedException();
		}
	}

	public void requireAdmin(MongoSession session) {
		if (!session.isAdmin())
			throw new RuntimeEx("auth fail");
	}

	public void ownerAuth(SubNode node) {
		ownerAuth(ThreadLocals.getMongoSession(), node);
	}

	public void auth(MongoSession session, SubNode node, PrivilegeType... privs) {
		// during server init no auth is required.
		if (node == null || !MongoRepository.fullInit) {
			return;
		}
		if (verbose)
			log.trace("auth: " + node.getPath());

		if (session.isAdmin()) {
			if (verbose)
				log.trace("you are admin. auth success.");
			return; // admin can do anything. skip auth
		}

		auth(session, node, Arrays.asList(privs));
	}

	/*
	 * The way know a node is an account node is that it is its id matches its' owner. Self owned node.
	 * This is because the very definition of the 'owner' on any given node is the ID of the user's root
	 * node of the user who owns it
	 */
	public boolean isAnAccountNode(MongoSession session, SubNode node) {
		return node.getId().toHexString().equals(node.getOwner().toHexString());
	}

	/* Returns true if this user on this session has privType access to 'node' */
	public void auth(MongoSession session, SubNode node, List<PrivilegeType> priv) {
		// during server init no auth is required.
		if (node == null || !MongoRepository.fullInit) {
			return;
		}

		// admin has full power over all nodes
		if (session.isAdmin()) {
			if (verbose)
				log.trace("auth granted. you're admin.");
			return;
		}

		if (verbose)
			log.trace("auth path " + node.getPath() + " for " + session.getUserName());

		/* Special case if this node is named 'home' it is readable by anyone */
		if (node != null && NodeName.HOME.equals(node.getName()) && priv.size() == 1 && priv.get(0).name().equals("READ")) {
			return;
		}

		if (priv == null || priv.size() == 0) {
			throw new RuntimeEx("privileges not specified.");
		}

		if (node.getOwner() == null) {
			throw new RuntimeEx("node had no owner: " + node.getPath());
		}

		// if this session user is the owner of this node, then they have full power
		if (session.getUserNodeId() != null && session.getUserNodeId().equals(node.getOwner())) {
			if (verbose)
				log.trace("allow: user " + session.getUserName() + " owns node. accountId: " + node.getOwner().toHexString());
			return;
		}

		// Find any ancestor that has priv shared to this user.
		if (ancestorAuth(session, node, priv)) {
			log.trace("ancestor auth success.");
			return;
		}

		log.trace("Unauthorized attempt at node id=" + node.getId() + " path=" + node.getPath());
		throw new NodeAuthFailedException();
	}

	/*
	 * Returns true if the user in 'session' has 'priv' access to node.
	 */
	private boolean ancestorAuth(MongoSession session, SubNode node, List<PrivilegeType> privs) {
		if (session.isAdmin())
			return true;
		if (verbose)
			log.trace("ancestorAuth: path=" + node.getPath());

		/* get the non-null sessionUserNodeId if not anonymous user */
		String sessionUserNodeId = session.getUserNodeId() != null ? session.getUserNodeId().toHexString() : null;
		ObjectId sessId = session.getUserNodeId() != null ? session.getUserNodeId() : null;

		// scan up the tree until we find a node that allows access
		while (node != null) {
			// if this session user is the owner of this node, then they have full power
			if (sessId != null && sessId.equals(node.getOwner())) {
				if (verbose)
					log.trace("auth success. node is owned.");
				return true;
			}

			if (nodeAuth(node, sessionUserNodeId, privs)) {
				if (verbose)
					log.trace("nodeAuth success");
				return true;
			}

			node = read.getParent(session, node, false);
			if (node != null) {
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
		// log.debug("nodeAuth: nodeId: " + node.getId().toHexString());
		HashMap<String, AccessControl> acl = node.getAc();
		if (acl == null) {
			// log.debug("no acls.");
			return false;
		}
		String allPrivs = "";

		AccessControl ac = (sessionUserNodeId == null ? null : acl.get(sessionUserNodeId));
		String privsForUserId = ac != null ? ac.getPrvs() : null;
		if (privsForUserId != null) {
			allPrivs += privsForUserId;
			// log.debug("Privs for this user: " + privsForUserId);
		}

		/*
		 * We always add on any privileges assigned to the PUBLIC when checking privs for this user, becasue
		 * the auth equivalent is really the union of this set.
		 */
		AccessControl acPublic = acl.get(PrincipalName.PUBLIC.s());
		String privsForPublic = acPublic != null ? acPublic.getPrvs() : null;
		if (privsForPublic != null) {
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

	public List<AccessControlInfo> getAclEntries(MongoSession session, SubNode node) {
		HashMap<String, AccessControl> aclMap = node.getAc();
		if (aclMap == null) {
			return null;
		}

		/*
		 * I'd like this to not be created unless needed but that pesky lambda below needs a 'final' thing
		 * to work with.
		 */
		List<AccessControlInfo> ret = new LinkedList<>();

		aclMap.forEach((k, v) -> {
			AccessControlInfo acei = createAccessControlInfo(session, k, v.getPrvs());
			if (acei != null) {
				ret.add(acei);
			}
		});

		return ret.size() == 0 ? null : ret;
	}

	public AccessControlInfo createAccessControlInfo(MongoSession session, String principalId, String authType) {
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
			SubNode principalNode = read.getNode(session, principalId, false);
			if (principalNode == null) {
				return null;
			}
			principalName = principalNode.getStrProp(NodeProp.USER.s());
			displayName = principalNode.getStrProp(NodeProp.DISPLAY_NAME.s());
			publicKey = principalNode.getStrProp(NodeProp.USER_PREF_PUBLIC_KEY.s());
			avatarVer = principalNode.getStrProp(NodeProp.BIN);
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
	public Iterable<SubNode> searchSubGraphByAclUser(MongoSession session, String pathToSearch, List<String> sharedToAny,
			Sort sort, int limit, ObjectId ownerIdMatch) {

		update.saveSession(session);
		Query query = subGraphByAclUser_query(session, pathToSearch, sharedToAny, ownerIdMatch);
		if (query == null)
			return null;

		if (sort != null) {
			query.with(sort);
		}

		query.limit(limit);
		return util.find(query);
	}

	/*
	 * counts all subnodes that have a share targeting the sharedTo (account node ID of a person being
	 * shared with), regardless of the type of share 'rd,rw'. To find public shares pass 'public' in
	 * sharedTo instead
	 */
	public long countSubGraphByAclUser(MongoSession session, String pathToSearch, List<String> sharedToAny,
			ObjectId ownerIdMatch) {
		update.saveSession(session);
		Query query = subGraphByAclUser_query(session, pathToSearch, sharedToAny, ownerIdMatch);
		if (query == null)
			return 0L;
		Long ret = ops.count(query, SubNode.class);
		return ret;
	}

	private Query subGraphByAclUser_query(MongoSession session, String pathToSearch, List<String> sharedToAny,
			ObjectId ownerIdMatch) {
		// this will be node.getPath() to search under the node, or null for searching
		// under all user content.
		if (pathToSearch == null) {
			pathToSearch = NodeName.ROOT_OF_ALL_USERS;
		}

		Query query = new Query();
		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(pathToSearch));

		if (sharedToAny != null && sharedToAny.size() > 0) {
			List<Criteria> orCriteria = new LinkedList<>();
			for (String share : sharedToAny) {
				orCriteria.add(Criteria.where(SubNode.FIELD_AC + "." + share).ne(null));
			}

			criteria.orOperator((Criteria[]) orCriteria.toArray(new Criteria[orCriteria.size()]));
		}

		if (ownerIdMatch != null) {
			criteria = criteria.and(SubNode.FIELD_OWNER).is(ownerIdMatch);
		}

		query.addCriteria(criteria);
		return query;
	}

	// ========================================================================
	// SubGraphByAcl (query and count)
	// ========================================================================

	/* Finds nodes that have any sharing on them at all */
	public Iterable<SubNode> searchSubGraphByAcl(MongoSession session, int skip, String pathToSearch, ObjectId ownerIdMatch,
			Sort sort, int limit) {
		update.saveSession(session);
		Query query = subGraphByAcl_query(session, pathToSearch, ownerIdMatch);

		if (sort != null) {
			query.with(sort);
		}

		if (skip > 0) {
			query.skip(skip);
		}

		query.limit(limit);
		return util.find(query);
	}

	/* Finds nodes that have any sharing on them at all */
	public long countSubGraphByAcl(MongoSession session, String pathToSearch, ObjectId ownerIdMatch) {
		update.saveSession(session);
		Query query = subGraphByAcl_query(session, pathToSearch, ownerIdMatch);
		return ops.count(query, SubNode.class);
	}

	public Query subGraphByAcl_query(MongoSession session, String pathToSearch, ObjectId ownerIdMatch) {
		Query query = new Query();

		if (pathToSearch == null) {
			pathToSearch = NodeName.ROOT_OF_ALL_USERS;
		}

		/*
		 * This regex finds all that START WITH path, have some characters after path, before the end of the
		 * string. Without the trailing (.+)$ we would be including the node itself in addition to all its
		 * children.
		 */
		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(pathToSearch)) //
				.and(SubNode.FIELD_AC).ne(null);

		if (ownerIdMatch != null) {
			criteria = criteria.and(SubNode.FIELD_OWNER).is(ownerIdMatch);
		}

		query.addCriteria(criteria);
		return query;
	}

	public HashSet<String> parseMentions(String message) {
		HashSet<String> userNames = new HashSet<>();

		// prepare so that newlines are compatable with out tokenizing
		message = message.replace("\n", " ");
		message = message.replace("\r", " ");

		List<String> words = XString.tokenize(message, " ", true);
		if (words != null) {
			for (String word : words) {
				// detect the pattern @name@server.com or @name
				if (word.length() > 6 && word.startsWith("@") && StringUtils.countMatches(word, "@") <= 2) {
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
	public HashSet<String> saveMentionsToNodeACL(MongoSession session, SubNode node) {
		HashSet<String> mentionsSet = parseMentions(node.getContent());

		boolean acChanged = false;
		HashMap<String, AccessControl> ac = node.getAc();

		// make sure all parsed toUserNamesSet user names are saved into the node acl */
		for (String userName : mentionsSet) {
			SubNode acctNode = read.getUserNodeByUserName(session, userName);

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
				// if (acctNode == null) {
				// acctNode = actPub.loadForeignUserByUserName(session, userName);
				// }
				actPub.userEncountered(userName, false);
			}

			if (acctNode != null) {
				String acctNodeId = acctNode.getId().toHexString();
				if (ac == null || !ac.containsKey(acctNodeId)) {
					/*
					 * Lazy create 'ac' so that the net result of this method is never to assign non null when it could
					 * be left null
					 */
					if (ac == null) {
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
			update.save(session, node);
		}
		return mentionsSet;
	}
}
