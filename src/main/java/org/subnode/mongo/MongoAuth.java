package org.subnode.mongo;

import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.StringTokenizer;

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
import org.subnode.config.AppProp;
import org.subnode.config.NodeName;
import org.subnode.config.SessionContext;
import org.subnode.exception.NodeAuthFailedException;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.AccessControlInfo;
import org.subnode.model.PrivilegeInfo;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.PrincipalName;
import org.subnode.model.client.PrivilegeType;
import org.subnode.mongo.model.AccessControl;
import org.subnode.mongo.model.SubNode;

/**
 * Utilities related to management of the JCR Repository
 */
@Component
public class MongoAuth {
	private static final Logger log = LoggerFactory.getLogger(MongoAuth.class);

	@Autowired
	private MongoTemplate ops;

	@Autowired
	private AppProp appProp;

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoUpdate update;

	@Autowired
	private MongoUtil util;

	@Autowired
	private SessionContext sessionContext;

	private static final MongoSession adminSession = MongoSession.createFromUser(PrincipalName.ADMIN.s());
	private static final MongoSession anonSession = MongoSession.createFromUser(PrincipalName.ANON.s());

	public static final HashMap<String, String> userNamesByAccountId = new HashMap<String, String>();

	public MongoSession getAdminSession() {
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

	public String getUserNameFromAccountNodeId(MongoSession session, String accountId) {

		// special case of a public share
		if ("public".equals(accountId)) {
			return "public";
		}

		// if the userName is cached get it from the cache, and then continue looping.
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

	/* Returns a list of all user names that are shared to on this node */
	public List<String> getUsersSharedTo(MongoSession session, SubNode node) {
		List<String> userNames = null;

		List<AccessControlInfo> acList = getAclEntries(session, node);
		if (acList != null) {
			for (AccessControlInfo info : acList) {
				String userNodeId = info.getPrincipalNodeId();
				if (userNodeId != null && !userNodeId.equalsIgnoreCase(PrincipalName.PUBLIC.s())) {
					SubNode accountNode = read.getNode(session, userNodeId);
					if (accountNode != null) {
						String userName = accountNode.getStrProp(NodeProp.USER);
						if (userName != null) {
							if (userNames == null) {
								userNames = new LinkedList<String>();
							}
							userNames.add(userName);
						}
					}
				}
			}
		}
		return userNames;
	}

	/*
	 * When a child is created under a parent we want to default the sharing on the
	 * child so that there's an explicit share to the parent which is redundant in
	 * terms of sharing auth, but is necessary and desiret for User Feeds and social
	 * media queries to work. Also we be sure to remove any share to 'child' user
	 * that may be in the parent Acl, because that would represent 'child' not
	 * sharing to himselv which is never done.
	 */
	public void setDefaultReplyAcl(SubNode parent, SubNode child) {
		if (parent == null || child == null)
			return;
		HashMap<String, AccessControl> ac = parent.getAc();
		if (ac == null) {
			ac = new HashMap<String, AccessControl>();
		} else {
			ac = (HashMap<String, AccessControl>) ac.clone();
			ac.remove(child.getOwner().toHexString());
		}
		ac.put(parent.getOwner().toHexString(), new AccessControl("prvs", "rd,wr"));
		child.setAc(ac);
	}

	public boolean isAllowedUserName(String userName) {
		userName = userName.trim();
		return !userName.equalsIgnoreCase(PrincipalName.ADMIN.s()) && //
				!userName.equalsIgnoreCase(PrincipalName.PUBLIC.s()) && //
				!userName.equalsIgnoreCase(PrincipalName.ANON.s());
	}

	public void authRequireOwnerOfNode(MongoSession session, SubNode node) {
		if (node == null) {
			throw new RuntimeEx("Auth Failed. Node did not exist.");
		}
		if (!session.isAdmin() && !session.getUserNode().getId().equals(node.getOwner())) {
			throw new RuntimeEx("Auth Failed. Node ownership required.");
		}
	}

	public void requireAdmin(MongoSession session) {
		if (!session.isAdmin())
			throw new RuntimeEx("auth fail");
	}

	public void auth(MongoSession session, SubNode node, PrivilegeType... privs) {
		if (node == null)
			return;
		if (session.isAdmin())
			return; // admin can do anything. skip auth
		auth(session, node, Arrays.asList(privs));
	}

	/*
	 * The way know a node is an account node is that it is its id matches its'
	 * owner. Self owned node. This is because the very definition of the 'owner' on
	 * any given node is the ID of the user's root node of the user who owns it
	 */
	public boolean isAnAccountNode(MongoSession session, SubNode node) {
		return node.getId().toHexString().equals(node.getOwner().toHexString());
	}

	/* Returns true if this user on this session has privType access to 'node' */
	public void auth(MongoSession session, SubNode node, List<PrivilegeType> priv) {

		/* Special case if this node is named 'home' it is readable by anyone */
		if (node != null && "home".equals(node.getName()) && priv.size() == 1 && priv.get(0).name().equals("READ")) {
			return;
		}

		if (priv == null || priv.size() == 0) {
			throw new RuntimeEx("privileges not specified.");
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
			throw new RuntimeEx("node had no owner: " + node.getPath());
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

	/*
	 * NOTE: this should ONLY ever be called from 'auth()' method of this class
	 */
	private boolean ancestorAuth(MongoSession session, SubNode node, List<PrivilegeType> privs) {

		/* get the non-null sessionUserNodeId if not anonymous user */
		String sessionUserNodeId = session.isAnon() ? null : session.getUserNode().getId().toHexString();

		log.trace("ancestorAuth: path=" + node.getPath());

		StringBuilder fullPath = new StringBuilder();
		StringTokenizer t = new StringTokenizer(node.getPath(), "/", false);
		boolean ret = false;
		while (t.hasMoreTokens()) {
			String pathPart = t.nextToken().trim();
			fullPath.append("/");
			fullPath.append(pathPart);

			if (pathPart.equals("/" + NodeName.ROOT))
				continue;
			if (pathPart.equals(NodeName.ROOT_OF_ALL_USERS))
				continue;

			String fullPathStr = fullPath.toString();

			/*
			 * get node from cache if possible. Note: This cache does have the slight
			 * imperfection that it assumes once it reads a node for the purposes of
			 * checking auth (acl) then within the context of the same transaction it can
			 * always use that same node again meaning the security context on the node
			 * can't have changed DURING the request. This is fine because we never update
			 * security on a node and then expect ourselves to find different security on
			 * the node. Because the only user who can update the security is the owner
			 * anyway.
			 */
			SubNode tryNode = MongoThreadLocal.getNodesByPath().get(fullPathStr);

			// if node not found in cache resort to querying for it
			if (tryNode == null) {
				tryNode = read.getNode(session, fullPathStr, false);
				if (tryNode == null) {
					throw new RuntimeEx("Tree corrupt! path not found: " + fullPathStr);
				}

				// put in the cache
				MongoThreadLocal.getNodesByPath().put(fullPathStr, tryNode);
			}

			// if this session user is the owner of this node, then they have full power
			if (!session.isAnon() && session.getUserNode().getId().equals(tryNode.getOwner())) {
				ret = true;
				break;
			}

			if (nodeAuth(tryNode, sessionUserNodeId, privs)) {
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
		AccessControl acPublic = acl.get(PrincipalName.PUBLIC.s());
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

	public List<AccessControlInfo> getAclEntries(MongoSession session, SubNode node) {
		HashMap<String, AccessControl> aclMap = node.getAc();
		if (aclMap == null) {
			return null;
		}

		/*
		 * I'd like this to not be created unless needed but that pesky lambda below
		 * needs a 'final' thing to work with.
		 */
		List<AccessControlInfo> ret = new LinkedList<AccessControlInfo>();

		aclMap.forEach((k, v) -> {
			AccessControlInfo acei = createAccessControlInfo(session, k, v.getPrvs());
			if (acei != null) {
				ret.add(acei);
			}
		});

		return ret.size() == 0 ? null : ret;
	}

	public AccessControlInfo createAccessControlInfo(MongoSession session, String principalId, String authType) {
		String principalName = null;
		String publicKey = null;

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
			publicKey = principalNode.getStrProp(NodeProp.USER_PREF_PUBLIC_KEY.s());
		}

		AccessControlInfo info = new AccessControlInfo(principalName, principalId, publicKey);
		info.addPrivilege(new PrivilegeInfo(authType));
		return info;
	}

	/*
	 * Finds all subnodes that have a share targeting the userNodeId (account node
	 * ID of a person being shared with), regardless of the type of share 'rd,rw'
	 */
	public Iterable<SubNode> searchSubGraphByAclUser(MongoSession session, String pathToSearch, String accountNodeId,
			String sortField, int limit) {

		// this will be node.getPath() to search under the node, or null for searching
		// under all user content.
		if (pathToSearch == null) {
			pathToSearch = NodeName.ROOT_OF_ALL_USERS;
		}

		update.saveSession(session);
		Query query = new Query();
		query.limit(limit);

		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(pathToSearch)) //
				.and(SubNode.FIELD_AC + "." + accountNodeId).ne(null);

		query.addCriteria(criteria);

		if (!StringUtils.isEmpty(sortField)) {
			query.with(Sort.by(Sort.Direction.DESC, sortField));
		}
		return ops.find(query, SubNode.class);
	}

	public long countSubGraphByAclUser(MongoSession session, String pathToSearch, String accountNodeId) {

		// this will be node.getPath() to search under the node, or null for searching
		// under all user content.
		if (pathToSearch == null) {
			pathToSearch = NodeName.ROOT_OF_ALL_USERS;
		}

		update.saveSession(session);
		Query query = new Query();

		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(pathToSearch)) //
				.and(SubNode.FIELD_AC + "." + accountNodeId).ne(null);

		query.addCriteria(criteria);
		return ops.count(query, SubNode.class);
	}

	/* Finds nodes that have any sharing on them at all */
	public Iterable<SubNode> searchSubGraphByAcl(MongoSession session, String pathToSearch, ObjectId ownerIdMatch,
			String sortField, int limit) {
		// auth(session, node, PrivilegeType.READ);

		// this will be node.getPath() to search under the node, or null for searching
		// under all user content.
		if (pathToSearch == null) {
			pathToSearch = NodeName.ROOT_OF_ALL_USERS;
		}

		update.saveSession(session);
		Query query = new Query();
		query.limit(limit);
		/*
		 * This regex finds all that START WITH path, have some characters after path,
		 * before the end of the string. Without the trailing (.+)$ we would be
		 * including the node itself in addition to all its children.
		 */
		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(pathToSearch)) //
				.and(SubNode.FIELD_AC).ne(null);

		if (ownerIdMatch != null) {
			criteria = criteria.and(SubNode.FIELD_OWNER).is(ownerIdMatch);
		}

		query.addCriteria(criteria);

		if (!StringUtils.isEmpty(sortField)) {
			query.with(Sort.by(Sort.Direction.DESC, sortField));
		}

		return ops.find(query, SubNode.class);
	}

	/* Finds nodes that have any sharing on them at all */
	public long countSubGraphByAcl(MongoSession session, SubNode node, ObjectId ownerIdMatch) {
		auth(session, node, PrivilegeType.READ);

		update.saveSession(session);
		Query query = new Query();

		/*
		 * This regex finds all that START WITH path, have some characters after path,
		 * before the end of the string. Without the trailing (.+)$ we would be
		 * including the node itself in addition to all its children.
		 */
		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(node.getPath())) //
				.and(SubNode.FIELD_AC).ne(null);

		if (ownerIdMatch != null) {
			criteria = criteria.and(SubNode.FIELD_OWNER).is(ownerIdMatch);
		}

		query.addCriteria(criteria);
		return ops.count(query, SubNode.class);
	}

	public MongoSession login(String userName, String password) {
		// log.debug("Mongo API login: user="+userName);
		MongoSession session = MongoSession.createFromUser(PrincipalName.ANON.s());

		/*
		 * If username is null or anonymous, we assume anonymous is acceptable and
		 * return anonymous session or else we check the credentials.
		 */
		if (!PrincipalName.ANON.s().equals(userName)) {
			log.trace("looking up user node.");
			SubNode userNode = read.getUserNodeByUserName(getAdminSession(), userName);
			boolean success = false;

			if (userNode != null) {

				/*
				 * If logging in as ADMIN we don't expect the node to contain any password in
				 * the db, but just use the app property instead.
				 */
				if (password.equals(appProp.getMongoAdminPassword())) {
					success = true;
				}
				// else it's an ordinary user so we check the password against their user node
				else if (userNode.getStrProp(NodeProp.PWD_HASH.s()).equals(util.getHashOfPassword(password))) {
					success = true;
				}
			}

			if (success) {
				session.setUser(userName);
				session.setUserNode(userNode);
			} else {
				throw new RuntimeEx("Login failed.");
			}
		}
		return session;
	}
}
