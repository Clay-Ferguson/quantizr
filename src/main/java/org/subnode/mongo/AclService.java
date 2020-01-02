package org.subnode.mongo;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;
import java.util.StringTokenizer;

import org.subnode.config.NodePrincipal;
import org.subnode.config.NodeProp;
import org.subnode.mail.JcrOutboxMgr;
import org.subnode.mongo.model.MongoPrincipal;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.AddPrivilegeRequest;
import org.subnode.request.GetNodePrivilegesRequest;
import org.subnode.request.RemovePrivilegeRequest;
import org.subnode.response.AddPrivilegeResponse;
import org.subnode.response.GetNodePrivilegesResponse;
import org.subnode.response.RemovePrivilegeResponse;
import org.subnode.response.base.ResponseBase;
import org.subnode.service.UserManagerService;
import org.subnode.util.ExUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Service methods for (ACL): processing security, privileges, and Access
 * Control List information on nodes.
 * 
 */
@Component
public class AclService {
	private static final Logger log = LoggerFactory.getLogger(AclService.class);

	@Autowired
	private MongoApi api;

	@Autowired
	private UserManagerService userManagerService;

	@Autowired
	private JcrOutboxMgr outboxMgr;

	/**
	 * Returns the privileges that exist on the node identified in the request.
	 */
	public void getNodePrivileges(MongoSession session, GetNodePrivilegesRequest req, GetNodePrivilegesResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		String nodeId = req.getNodeId();
		SubNode node = api.getNode(session, nodeId);

		if (!req.isIncludeAcl() && !req.isIncludeOwners()) {
			throw ExUtil.newEx("no specific information requested for getNodePrivileges");
		}

		if (req.isIncludeAcl()) {
			res.setAclEntries(api.getAclEntries(session, node));
		}

		if (req.isIncludeOwners()) {
			List<String> owners = userManagerService.getOwnerNames(node);
			// log.info("Owner Count: " + owners.size());
			res.setOwners(owners);
		}

		res.setSuccess(true);
	}

	/*
	 * I made this privilege capable of doing either a 'publicAppend' update, or
	 * actual privileges update. Only one at a time will be done, usually, if not
	 * always.
	 *
	 * Adds a new privilege to a node using HTTP request param objects. Request
	 * object is self explanatory.
	 */
	public void addPrivilege(MongoSession session, AddPrivilegeRequest req, AddPrivilegeResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		String nodeId = req.getNodeId();
		SubNode node = api.getNode(session, nodeId);
		api.authRequireOwnerOfNode(session, node);

		boolean success = addPrivilege(session, node, req.getPrincipal(), req.getPrivileges(), res);

		// if (req.getPublicAppend() != null) {
		// 	// boolean publicAppend = req.getPublicAppend().booleanValue();
		// 	// if (!publicAppend) {
		// 	// JcrUtil.safeDeleteProperty(node, JcrProp.PUBLIC_APPEND);
		// 	// }
		// 	// else {
		// 	// node.setProperty(JcrProp.PUBLIC_APPEND, true);
		// 	// }
		// 	// success = true;
		// }

		res.setSuccess(success);
	}

	public boolean addPrivilege(MongoSession session, SubNode node, String principal, List<String> privileges, ResponseBase res) {
		boolean success = false;
		if (principal != null) {
			String mapKey = null;

			/* If we are sharing to public, then that's the map key */
			if (principal.equalsIgnoreCase(NodePrincipal.PUBLIC)) {
				mapKey = NodePrincipal.PUBLIC;
			}
			/*
			 * otherwise sharing to a person so their userNodeId is the map key in this case
			 */
			else {
				SubNode principleNode = api.getUserNodeByUserName(api.getAdminSession(), principal);
				if (principleNode == null) {
					if (res != null) {
						res.setMessage("Unknown user name: " + principal);
						res.setSuccess(false);
					}
					return false;
				}
				mapKey = principleNode.getId().toHexString();

				//todo-1: send not just notification email, but send to people's INBOX node also.
				//will require us to invent the INBOX for user. Doesn't yet exist.
			}

			HashMap<String, String> acl = node.getAcl();
			if (acl == null) {
				acl = new HashMap<String, String>();
			}
			String authForPrinciple = acl.get(mapKey);
			if (authForPrinciple == null) {
				authForPrinciple = "";
			}

			boolean authAdded = false;
			for (String priv : privileges) {
				if (authForPrinciple.indexOf(priv) == -1) {
					authAdded = true;
					if (authForPrinciple.length() > 0) {
						authForPrinciple += ",";
					}
					authForPrinciple += priv;
				}
			}

			if (authAdded) {
				acl.put(mapKey, authForPrinciple);
				node.setAcl(acl);
				api.save(session, node);
			}

			success = true;
		}
		return success;
	}

	public void removeAclEntry(MongoSession session, SubNode node, String principleNodeId, String privToRemove) {
		HashSet<String> setToRemove = XString.tokenizeToSet(privToRemove, ",", true);

		HashMap<String, String> acl = node.getAcl();
		if (acl == null)
			return;
		String privs = acl.get(principleNodeId);
		if (privs == null) {
			log.debug("ACL didn't contain principleNodeId " + principleNodeId + "\nACL DUMP: "
					+ XString.prettyPrint(acl));
			return;
		}
		StringTokenizer t = new StringTokenizer(privs, ",", false);
		String newPrivs = "";
		boolean removed = false;

		while (t.hasMoreTokens()) {
			String tok = t.nextToken().trim();
			if (setToRemove.contains(tok)) {
				removed = true;
				continue;
			}
			if (newPrivs.length() > 0) {
				newPrivs += ",";
			}
			newPrivs += tok;
		}

		if (removed) {
			/*
			 * If there are no privileges left for this principle, then remove the principle
			 * entry completely from the ACL. We don't store empty ones.
			 */
			if (newPrivs.equals("")) {
				acl.remove(principleNodeId);
			} else {
				acl.put(principleNodeId, newPrivs);
			}

			/*
			 * if there are now no acls at all left set the ACL to null, so it is completely
			 * removed from the node
			 */
			if (acl.isEmpty()) {
				node.setAcl(null);
			} else {
				node.setAcl(acl);
			}

			api.save(session, node);
		}
	}

	/*
	 * Removes the privilege specified in the request from the node specified in the
	 * request
	 */
	public void removePrivilege(MongoSession session, RemovePrivilegeRequest req, RemovePrivilegeResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		String nodeId = req.getNodeId();
		SubNode node = api.getNode(session, nodeId);
		api.authRequireOwnerOfNode(session, node);

		String principalNodeId = req.getPrincipalNodeId();
		String privilege = req.getPrivilege();

		removeAclEntry(session, node, principalNodeId, privilege);
		res.setSuccess(true);
	}

	public List<String> getOwnerNames(MongoSession session, SubNode node) {
		Set<String> ownerSet = new HashSet<String>();
		/*
		 * We walk up the tree util we get to the root, or find ownership on node, or
		 * any of it's parents
		 */

		int sanityCheck = 0;
		while (++sanityCheck < 100) {
			List<MongoPrincipal> principals = getNodePrincipals(session, node);
			for (MongoPrincipal p : principals) {

				// todo-3: this is a spot that can be optimized. We should be able to send just
				// the
				// userNodeId back to client, and the client
				// should be able to deal with that (i think). depends on how much ownership
				// info we
				// need to show user.
				// ownerSet.add(p.getUserNodeId());
				SubNode userNode = api.getNode(session, p.getUserNodeId());
				String userName = userNode.getStringProp(NodeProp.USER);
				ownerSet.add(userName);
			}

			if (principals.size() == 0) {
				node = api.getParent(session, node);
				if (node == null)
					break;
			} else {
				break;
			}
		}

		List<String> ownerList = new LinkedList<String>(ownerSet);
		Collections.sort(ownerList);
		return ownerList;
	}

	public static List<MongoPrincipal> getNodePrincipals(MongoSession session, SubNode node) {
		List<MongoPrincipal> principals = new LinkedList<MongoPrincipal>();
		MongoPrincipal principal = new MongoPrincipal();
		principal.setUserNodeId(node.getId());
		principal.setAccessLevel("w");
		principals.add(principal);
		return principals;
	}
}
