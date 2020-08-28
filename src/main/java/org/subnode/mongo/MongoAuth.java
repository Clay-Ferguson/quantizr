package org.subnode.mongo;

import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.StringTokenizer;

import org.apache.commons.lang3.StringUtils;
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

	private static final MongoSession adminSession = MongoSession.createFromUser(PrincipalName.ADMIN.s());
	private static final MongoSession anonSession = MongoSession.createFromUser(PrincipalName.ANON.s());

	public MongoSession getAdminSession() {
		return adminSession;
	}

	public MongoSession getAnonSession() {
		return anonSession;
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
	 * 
	 * todo-1: MongoThreadLocal class has a variable created to memoize these
	 * results per-request but that has not yet been implemented.
	 */
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
			if (pathPart.equals(NodeName.ROOT_OF_ALL_USERS))
				continue;

			// I'm putting the caching of ACL results on hold, because this is only a
			// performance
			// enhancement and can wait.
			// Boolean knownAuthResult =
			// MongoThreadLocal.aclResults().get(buildAclThreadLocalKey(sessionUserNodeId,
			// fullPath,
			// privs));

			SubNode tryNode = read.getNode(session, fullPath.toString(), false);
			if (tryNode == null) {
				throw new RuntimeEx("Tree corrupt! path not found: " + fullPath.toString());
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
			principalName = principalNode.getStringProp(NodeProp.USER.s());
			publicKey = principalNode.getStringProp(NodeProp.USER_PREF_PUBLIC_KEY.s());
		}

		AccessControlInfo info = new AccessControlInfo(principalName, principalId, publicKey);
		info.addPrivilege(new PrivilegeInfo(authType));
		return info;
	}

    public Iterable<SubNode> searchSubGraphByAcl(MongoSession session, SubNode node, String sortField, int limit) {
		auth(session, node, PrivilegeType.READ);

		update.saveSession(session);
		Query query = new Query();
		query.limit(limit);
		/*
		 * This regex finds all that START WITH path, have some characters after path,
		 * before the end of the string. Without the trailing (.+)$ we would be
		 * including the node itself in addition to all its children.
		 */

		Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(node.getPath())) //
				.and(SubNode.FIELD_AC).ne(null);

		// examples from online:
		// Aggregation aggregation = Aggregation.newAggregation(
		// Aggregation.match(Criteria.where("docs").exists(true)));
		// Aggregation aggregation =
		// Aggregation.newAggregation(Aggregation.match(Criteria.where("docs").ne(Collections.EMPTY_LIST)));
		// Criteria.where("docs").not().size(0);

		query.addCriteria(criteria);

		if (!StringUtils.isEmpty(sortField)) {
			query.with(Sort.by(Sort.Direction.DESC, sortField));
		}

		return ops.find(query, SubNode.class);
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
				else if (userNode.getStringProp(NodeProp.PWD_HASH.s()).equals(util.getHashOfPassword(password))) {
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
