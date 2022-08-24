package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;
import java.util.StringTokenizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.BulkOperations.BulkMode;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;
import com.mongodb.bulk.BulkWriteResult;
import quanta.actpub.APConst;
import quanta.config.ServiceBase;
import quanta.exception.NodeAuthFailedException;
import quanta.exception.base.RuntimeEx;
import quanta.model.client.NodeProp;
import quanta.model.client.PrincipalName;
import quanta.mongo.MongoSession;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.MongoPrincipal;
import quanta.mongo.model.SubNode;
import quanta.request.AddPrivilegeRequest;
import quanta.request.CopySharingRequest;
import quanta.request.GetNodePrivilegesRequest;
import quanta.request.RemovePrivilegeRequest;
import quanta.request.SetCipherKeyRequest;
import quanta.request.SetUnpublishedRequest;
import quanta.response.AddPrivilegeResponse;
import quanta.response.CopySharingResponse;
import quanta.response.GetNodePrivilegesResponse;
import quanta.response.RemovePrivilegeResponse;
import quanta.response.SetCipherKeyResponse;
import quanta.response.SetUnpublishedResponse;
import quanta.util.ExUtil;
import quanta.util.XString;

/**
 * Service methods for (ACL): processing security, privileges, and Access Control List information
 * on nodes.
 */
@Component
public class AclService extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(AclService.class);

	/**
	 * Returns the privileges that exist on the node identified in the request.
	 */
	public GetNodePrivilegesResponse getNodePrivileges(MongoSession ms, GetNodePrivilegesRequest req) {
		GetNodePrivilegesResponse res = new GetNodePrivilegesResponse();

		String nodeId = req.getNodeId();
		SubNode node = read.getNode(ms, nodeId);

		res.setUnpublished(node.getBool(NodeProp.UNPUBLISHED));

		if (!req.isIncludeAcl() && !req.isIncludeOwners()) {
			throw ExUtil.wrapEx("no specific information requested for getNodePrivileges");
		}

		if (req.isIncludeAcl()) {
			res.setAclEntries(auth.getAclEntries(ms, node));
		}

		if (req.isIncludeOwners()) {
			List<String> owners = user.getOwnerNames(node);
			// log.info("Owner Count: " + owners.size());
			res.setOwners(owners);
		}

		res.setSuccess(true);
		return res;
	}

	public CopySharingResponse copySharing(MongoSession ms, CopySharingRequest req) {
		CopySharingResponse res = new CopySharingResponse();

		SubNode node = read.getNode(ms, req.getNodeId());
		BulkOperations bops = null;

		/*
		 * todo-1: It seems like maybe batching can't update a collection property? so for now I'm
		 * disabling, and yes disabling batch mode makes this code work.
		 */
		boolean batchMode = false;

		Boolean unpublished = node.getBool(NodeProp.UNPUBLISHED);

		for (SubNode n : read.getSubGraph(ms, node, null, 0, true, false)) {
			if (batchMode) {
				// lazy instantiate
				if (no(bops)) {
					bops = ops.bulkOps(BulkMode.UNORDERED, SubNode.class);
				}

				try {
					auth.ownerAuth(ms, n);
					
					// #unpublish-disabled
					//n.set(NodeProp.UNPUBLISHED, unpublished ? unpublished : null);

					Query query = new Query().addCriteria(new Criteria("id").is(n.getId()));
					// log.debug("Setting [" + n.getIdStr() + "] AC to " + XString.prettyPrint(node.getAc()));
					Update update = new Update().set(SubNode.AC, node.getAc()).set(SubNode.PROPS, n.getProps());
					bops.updateOne(query, update);
				} catch (Exception e) {
					// not an error, we just can't properties on nodes we don't own, so we skip them
				}
			} else {
				auth.ownerAuth(ms, n);

				// #unpublish-disabled
				// n.set(NodeProp.UNPUBLISHED, unpublished ? unpublished : null);
				n.setAc(node.getAc());
			}
		}

		if (batchMode && ok(bops)) {
			BulkWriteResult results = bops.execute();
			log.debug("Bulk Privileges: updated " + results.getModifiedCount() + " nodes.");
		} else {
			update.saveSession(ms);
		}
		res.setSuccess(true);
		return res;
	}

	/*
	 * Adds or updates a new privilege to a node
	 */
	public AddPrivilegeResponse addPrivilege(MongoSession ms, AddPrivilegeRequest req) {
		AddPrivilegeResponse res = new AddPrivilegeResponse();

		String nodeId = req.getNodeId();
		req.setPrincipal(XString.stripIfStartsWith(req.getPrincipal(), "@"));
		SubNode node = read.getNode(ms, nodeId);
		auth.ownerAuth(ms, node);

		boolean success = addPrivilege(ms, null, node, req.getPrincipal(), req.getPrivileges(), res);
		res.setSuccess(success);
		return res;
	}

	/*
	 * Adds or updates a new privilege to a node
	 */
	public SetUnpublishedResponse setUnpublished(MongoSession ms, SetUnpublishedRequest req) {
		SetUnpublishedResponse res = new SetUnpublishedResponse();

		String nodeId = req.getNodeId();
		SubNode node = read.getNode(ms, nodeId);
		auth.ownerAuth(ms, node);

		// #unpublish-disabled
		// node.set(NodeProp.UNPUBLISHED, req.isUnpublished() ? true : null);

		res.setSuccess(true);
		return res;
	}

	/*
	 * Adds or updates a new encryption key to a node
	 */
	public SetCipherKeyResponse setCipherKey(MongoSession ms, SetCipherKeyRequest req) {
		SetCipherKeyResponse res = new SetCipherKeyResponse();

		String nodeId = req.getNodeId();
		SubNode node = read.getNode(ms, nodeId);
		auth.ownerAuth(ms, node);

		String cipherKey = node.getStr(NodeProp.ENC_KEY);
		if (no(cipherKey)) {
			throw new RuntimeEx("Attempted to alter keys on a non-encrypted node.");
		}

		boolean success = setCipherKey(ms, node, req.getPrincipalNodeId(), req.getCipherKey(), res);
		res.setSuccess(success);
		return res;
	}

	public boolean setCipherKey(MongoSession ms, SubNode node, String principalNodeId, String cipherKey,
			SetCipherKeyResponse res) {
		boolean ret = false;

		HashMap<String, AccessControl> acl = node.getAc();
		AccessControl ac = acl.get(principalNodeId);
		if (ok(ac)) {
			ac.setKey(cipherKey);
			node.setAc(acl);
			update.save(ms, node);
			ret = true;
		}
		return ret;
	}

	/**
	 * Adds the privileges to the node sharing this node to principal, which will be either a userName
	 * or 'public' (when the node is being shared to public)
	 * 
	 * If BulkOperations is non-null we use it instead of a non-bulk operation
	 */
	public boolean addPrivilege(MongoSession ms, BulkOperations bops, SubNode node, String principal, List<String> privileges,
			AddPrivilegeResponse res) {

		if (no(principal) || no(node))
			return false;
		principal = principal.trim();

		String cipherKey = node.getStr(NodeProp.ENC_KEY);
		String mapKey = null;

		SubNode principalNode = null;
		boolean isPublic = false;
		/* If we are sharing to public, then that's the map key */
		if (principal.equalsIgnoreCase(PrincipalName.PUBLIC.s())) {
			if (ok(cipherKey)) {
				throw new RuntimeEx("Cannot make an encrypted node public.");
			}
			mapKey = PrincipalName.PUBLIC.s();
			isPublic = true;
		}
		/*
		 * otherwise we're sharing to a person so we now get their userNodeId to use as map key
		 */
		else {
			String _principal = principal;
			principalNode = arun.run(as -> read.getUserNodeByUserName(as, _principal));
			if (no(principalNode)) {
				if (ok(res)) {
					res.setMessage("Unknown user name: " + principal);
					res.setSuccess(false);
				}
				return false;
			}
			mapKey = principalNode.getIdStr();

			/*
			 * If this node is encrypted we get the public key of the user being shared with to send back to the
			 * client, which will then use it to encrypt the symmetric key to the data, and then send back up to
			 * the server to store in this sharing entry
			 */
			if (ok(cipherKey)) {
				String principalPubKey = principalNode.getStr(NodeProp.USER_PREF_PUBLIC_KEY);
				if (no(principalPubKey)) {
					if (ok(res)) {
						res.setMessage("User doesn't have a PublicKey available: " + principal);
						res.setSuccess(false);
						return false;
					}
				}
				log.debug("principalPublicKey: " + principalPubKey);

				if (ok(res)) {
					res.setPrincipalPublicKey(principalPubKey);
					res.setPrincipalNodeId(mapKey);
				}
			}
		}

		HashMap<String, AccessControl> acl = node.getAc();

		/* initialize acl to a map if it's null, or if we're sharing to public */
		if (no(acl)) {
			acl = new HashMap<>();
		}

		/*
		 * Get access control entry from map, but if one is not found, we can just create one.
		 */
		AccessControl ac = acl.get(mapKey);
		if (no(ac)) {
			ac = new AccessControl();
		}

		String prvs = ac.getPrvs();
		/*
		 * to set from 'rd' to 'rd,rw' back and forth then it's better to set prvs to an empty string here
		 * any time we detect this is 'public' priv being set.
		 */
		if (no(prvs) || isPublic) {
			prvs = "";
		}

		boolean authAdded = false;

		/* Scan all the privileges to be added to this principal (rd, rw, etc) */
		for (String priv : privileges) {
			/* If this privilege is not already on ac.prvs string then append it */
			if (prvs.indexOf(priv) == -1) {
				authAdded = true;
				if (prvs.length() > 0) {
					prvs += ",";
				}
				prvs += priv;
			}
		}

		if (authAdded) {
			ac.setPrvs(prvs);
			acl.put(mapKey, ac);

			// if bulk operation
			if (ok(bops)) {
				/*
				 * todo-1: this needs testing because the other place I'm doing similar code elsewhere refuses to
				 * work somehow. Seems like updating collections might not work in batching. Currently there are no
				 * places we call this method with bops passed in, so this bops branch is not currently being used
				 * for that reason.
				 */
				Query query = new Query().addCriteria(new Criteria("id").is(node.getId()));
				Update update = new Update().set(SubNode.AC, acl);
				bops.updateOne(query, update);
			}
			// else non-bulk
			else {
				node.setAc(acl);
				update.save(ms, node);
			}

			// if (!principal.equalsIgnoreCase(PrincipalName.PUBLIC.s())) {
			// SubNode fromUserNode = read.getNode(session, node.getOwner());
			// String fromUserName = fromUserNode.getStrProp(NodeProp.USER);
			// SubNode toOwnerNode = read.getUserNodeByUserName(auth.getAdminSession(), principal);
			// /*
			// * todo-2: Although I am disabling these for now both of these lines of code do work perfectly: we
			// * can send an email notification here about node edits (first line), and the line below that
			// works
			// * fine and adds a node to the user's inbox that links to this newly shared node.
			// *
			// * I just want to think more about when exactly to trigger these notifictions. For example I may
			// * make these two buttons on the editor users must click called "Email Notification to Shares",
			// and
			// * "Send to Inboxes of Shares"
			// */
			// // outboxMgr.sendEmailNotification(auth.getAdminSession(), fromUserName, toOwnerNode, node);
			// // outboxMgr.addInboxNotification(principal, toOwnerNode, node, "New node shared to you.");
			// }
		}

		return true;
	}

	public void removeAclEntry(MongoSession ms, SubNode node, String principalNodeId, String privToRemove) {

		/* special syntax is we remove all if asterisk specified */
		if (principalNodeId.equals("*")) {
			node.setAc(null);
			update.save(ms, node);
			return;
		}

		HashMap<String, AccessControl> acl = node.getAc();
		if (no(acl))
			return;

		String newPrivs = "";
		boolean removed = false;
		AccessControl ac = null;

		// if removing all privileges
		if ("*".equals(privToRemove)) {
			removed = true;
		}
		// else removing just some specific privileges
		else {
			ac = acl.get(principalNodeId);
			if (no(ac)) {
				log.debug("ac not found for " + principalNodeId + "\nACL DUMP: " + XString.prettyPrint(acl));
				return;
			}

			String privs = ac.getPrvs();
			if (no(privs)) {
				log.debug("privs not found for " + principalNodeId + "\nACL DUMP: " + XString.prettyPrint(acl));
				return;
			}

			HashSet<String> setToRemove = XString.tokenizeToSet(privToRemove, ",", true);
			StringTokenizer t = new StringTokenizer(privs, ",", false);

			/*
			 * build the new comma-delimited privs list by adding all that aren't in the setToRemove
			 */
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
		}

		if (removed) {
			/*
			 * If there are no privileges left for this principal, then remove the principal entry completely
			 * from the ACL. We don't store empty ones.
			 */
			if (newPrivs.equals("")) {
				acl.remove(principalNodeId);
			} else {
				ac.setPrvs(newPrivs);
				acl.put(principalNodeId, ac);
			}

			/*
			 * if there are now no acls at all left set the ACL to null, so it is completely removed from the
			 * node
			 */
			if (acl.isEmpty()) {
				node.setAc(null);
			} else {
				node.setAc(acl);
			}

			update.save(ms, node);
		}
	}

	/*
	 * Removes the privilege specified in the request from the node specified in the request
	 */
	public RemovePrivilegeResponse removePrivilege(MongoSession ms, RemovePrivilegeRequest req) {
		RemovePrivilegeResponse res = new RemovePrivilegeResponse();

		String nodeId = req.getNodeId();
		SubNode node = read.getNode(ms, nodeId);
		auth.ownerAuth(ms, node);

		removeAclEntry(ms, node, req.getPrincipalNodeId(), req.getPrivilege());

		res.setSuccess(true);
		return res;
	}

	public List<String> getOwnerNames(MongoSession ms, SubNode node) {
		Set<String> ownerSet = new HashSet<>();
		/*
		 * We walk up the tree util we get to the root, or find ownership on node, or any of it's parents
		 */

		int sanityCheck = 0;
		while (++sanityCheck < 100) {
			List<MongoPrincipal> principals = getNodePrincipals(ms, node);
			for (MongoPrincipal p : principals) {

				/*
				 * todo-3: this is a spot that can be optimized. We should be able to send just the userNodeId back
				 * to client, and the client should be able to deal with that (i think). depends on how much
				 * ownership info we need to show user. ownerSet.add(p.getUserNodeId());
				 */
				SubNode userNode = read.getNode(ms, p.getUserNodeId());
				String userName = userNode.getStr(NodeProp.USER);
				ownerSet.add(userName);
			}

			if (principals.size() == 0) {
				node = read.getParent(ms, node);
				if (no(node))
					break;
			} else {
				break;
			}
		}

		List<String> ownerList = new LinkedList<>(ownerSet);
		Collections.sort(ownerList);
		return ownerList;
	}

	public static List<MongoPrincipal> getNodePrincipals(MongoSession ms, SubNode node) {
		List<MongoPrincipal> principals = new LinkedList<>();
		MongoPrincipal principal = new MongoPrincipal();
		principal.setUserNodeId(node.getId());
		principal.setAccessLevel("w");
		principals.add(principal);
		return principals;
	}

	public static boolean isPublic(MongoSession ms, SubNode node) {
		return ok(node) && ok(node.getAc()) && node.getAc().containsKey(PrincipalName.PUBLIC.s());
	}

	public void makePublicAppendable(MongoSession ms, SubNode node) {
		setKeylessPriv(ms, node, PrincipalName.PUBLIC.s(), APConst.RDWR);
	}

	// The effeciency of using this function is it won't set the node to dirty of nothing changed.
	public void setKeylessPriv(MongoSession ms, SubNode node, String key, String prvs) {
		// if no privileges exist at all just add the one we need to add
		if (no(node.getAc())) {
			node.putAc(key, new AccessControl(null, prvs));
		}
		// otherwise first check to see if it's already added
		else {
			AccessControl ac = node.getAc().get(key);
			if (ok(ac) && ac.getPrvs().equals(prvs)) {
				// already had the correct ac, nothing to do here
			}
			// else need to add it.
			else {
				node.putAc(key, new AccessControl(null, prvs));
			}
		}
	}

	public void failIfAdminOwned(SubNode node) {
		if (isAdminOwned(node)) {
			throw new NodeAuthFailedException();
		}
	}

	public boolean isAdminOwned(SubNode node) {
		return node.getOwner().equals(auth.getAdminSession().getUserNodeId());
	}
}
