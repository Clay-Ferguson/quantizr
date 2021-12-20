package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import quanta.actpub.ActPubFollower;
import quanta.actpub.ActPubFollowing;
import quanta.actpub.ActPubService;
import quanta.actpub.ActPubUtil;
import quanta.actpub.model.APList;
import quanta.config.NodeName;
import quanta.exception.base.RuntimeEx;
import quanta.model.NodeInfo;
import quanta.model.PropertyInfo;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.AdminRun;
import quanta.mongo.CreateNodeLocation;
import quanta.mongo.MongoAuth;
import quanta.mongo.MongoCreate;
import quanta.mongo.MongoRead;
import quanta.mongo.MongoSession;
import quanta.mongo.MongoUpdate;
import quanta.mongo.MongoUtil;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.SubNode;
import quanta.request.AppDropRequest;
import quanta.request.CreateSubNodeRequest;
import quanta.request.DeletePropertyRequest;
import quanta.request.InsertNodeRequest;
import quanta.request.SaveNodeRequest;
import quanta.request.SearchAndReplaceRequest;
import quanta.request.SplitNodeRequest;
import quanta.request.TransferNodeRequest;
import quanta.request.UpdateHeadingsRequest;
import quanta.response.AppDropResponse;
import quanta.response.CreateSubNodeResponse;
import quanta.response.DeletePropertyResponse;
import quanta.response.InsertNodeResponse;
import quanta.response.SaveNodeResponse;
import quanta.response.SearchAndReplaceResponse;
import quanta.response.SplitNodeResponse;
import quanta.response.TransferNodeResponse;
import quanta.response.UpdateHeadingsResponse;
import quanta.types.TypeBase;
import quanta.types.TypePluginMgr;
import quanta.util.AsyncExec;
import quanta.util.Convert;
import quanta.util.SubNodeUtil;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import quanta.util.Val;
import quanta.util.XString;

/**
 * Service for editing content of nodes. That is, this method updates property values of nodes. As
 * the user is using the application and moving, copy+paste, or editing node content this is the
 * service that performs those operations on the server, directly called from the HTML 'controller'
 */
@Lazy
@Component
public class NodeEditService {
	private static final Logger log = LoggerFactory.getLogger(NodeEditService.class);

	@Autowired
	@Lazy
	protected Convert convert;

	@Autowired
	@Lazy
	protected IPFSService ipfs;

	@Autowired
	@Lazy
	protected TypePluginMgr typePluginMgr;

	@Autowired
	@Lazy
	protected PushService push;

	@Autowired
	@Lazy
	protected ActPubUtil apUtil;

	@Autowired
	@Lazy
	protected ActPubFollower apFollower;

	@Autowired
	@Lazy
	protected ActPubService apub;

	@Autowired
	@Lazy
	protected ActPubFollowing apFollowing;

	@Autowired
	@Lazy
	protected AsyncExec asyncExec;

	@Autowired
	@Lazy
	protected AdminRun arun;

	@Autowired
	@Lazy
	private SubNodeUtil snUtil;

	@Autowired
	@Lazy
	protected AclService acl;

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

	@Autowired
	@Lazy
	protected MongoCreate create;

	/*
	 * Creates a new node as a *child* node of the node specified in the request. Should ONLY be called
	 * by the controller that accepts a node being created by the GUI/user
	 */
	public CreateSubNodeResponse createSubNode(MongoSession ms, CreateSubNodeRequest req) {
		// log.debug("createSubNode");
		CreateSubNodeResponse res = new CreateSubNodeResponse();
		ms = ThreadLocals.ensure(ms);

		boolean linkBookmark = "linkBookmark".equals(req.getPayloadType());
		String nodeId = req.getNodeId();
		boolean makePublicWritable = false;
		boolean allowSharing = true;
		SubNode node = null;

		/*
		 * If this is a "New Post" from the Feed tab we get here with no ID but we put this in user's
		 * "My Posts" node
		 */
		if (no(nodeId) && !linkBookmark) {
			node = read.getUserNodeByType(ms, null, null, "### " + ThreadLocals.getSC().getUserName() + "'s Public Posts",
					NodeType.POSTS.s(), Arrays.asList(PrivilegeType.READ.s()), NodeName.POSTS);

			if (ok(node)) {
				nodeId = node.getIdStr();
				makePublicWritable = true;
			}
		}

		/* Node still null, then try other ways of getting it */
		if (no(node) && !linkBookmark) {
			if (nodeId.equals("~" + NodeType.NOTES.s())) {
				node = read.getUserNodeByType(ms, ms.getUserName(), null, "### Notes", NodeType.NOTES.s(), null, null);
			} else {
				node = read.getNode(ms, nodeId);
			}
		}

		TypeBase plugin = typePluginMgr.getPluginByType(req.getTypeName());
		if (ok(plugin)) {
			Val<SubNode> vcNode = new Val<>(node);
			plugin.createSubNode(ms, vcNode, req, linkBookmark);
			node = vcNode.getVal();
		}

		if (no(node)) {
			throw new RuntimeException("unable to locate parent for insert");
		}

		auth.authForChildNodeCreate(ms, node);
		CreateNodeLocation createLoc = req.isCreateAtTop() ? CreateNodeLocation.FIRST : CreateNodeLocation.LAST;

		SubNode newNode = create.createNode(ms, node, null, req.getTypeName(), 0L, createLoc, req.getProperties(), null, true);

		if (req.isPendingEdit()) {
			mongoUtil.setPendingPath(newNode, true);
		}

		newNode.setContent(ok(req.getContent()) ? req.getContent() : "");
		newNode.touch();

		if (NodeType.BOOKMARK.s().equals(req.getTypeName())) {
			newNode.set(NodeProp.TARGET_ID.s(), req.getNodeId());

			// adding bookmark should disallow sharing.
			allowSharing = false;
		}

		if (req.isTypeLock()) {
			newNode.set(NodeProp.TYPE_LOCK.s(), Boolean.valueOf(true));
		}

		// If we're inserting a node under the POSTS it should be public, rather than inherit.
		if (node.isType(NodeType.POSTS)) {
			makePublicWritable = true;
		}

		if (allowSharing) {
			// if a user to share to (a Direct Message) is provided, add it.
			if (ok(req.getShareToUserId())) {
				HashMap<String, AccessControl> ac = new HashMap<>();
				ac.put(req.getShareToUserId(), new AccessControl(null, PrivilegeType.READ.s() + "," + PrivilegeType.WRITE.s()));
				newNode.setAc(ac);
			}
			// else maybe public.
			else if (makePublicWritable) {
				acl.addPrivilege(ms, newNode, PrincipalName.PUBLIC.s(),
						Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
			}
			// else add default sharing
			else {
				// we always determine the access controls from the parent for any new nodes
				auth.setDefaultReplyAcl(null, node, newNode);

				String cipherKey = node.getStr(NodeProp.ENC_KEY.s());
				if (ok(cipherKey)) {
					res.setEncrypt(true);
				}
			}
		}

		update.save(ms, newNode);
		res.setNewNode(convert.convertToNodeInfo(ThreadLocals.getSC(), ms, newNode, true, false, -1, false, false, false, false));

		res.setSuccess(true);
		return res;
	}

	public SubNode createFriendNode(MongoSession ms, SubNode parentFriendsList, String userToFollow) {

		SubNode userNode = read.getUserNodeByUserName(ms, userToFollow, false);
		if (ok(userNode)) {
			List<PropertyInfo> properties = new LinkedList<>();
			properties.add(new PropertyInfo(NodeProp.USER.s(), userToFollow));
			properties.add(new PropertyInfo(NodeProp.USER_NODE_ID.s(), userNode.getIdStr()));

			SubNode newNode = create.createNode(ms, parentFriendsList, null, NodeType.FRIEND.s(), 0L, CreateNodeLocation.LAST,
					properties, parentFriendsList.getOwner(), true);
			newNode.set(NodeProp.TYPE_LOCK.s(), Boolean.valueOf(true));

			String userToFollowActorId = userNode.getStr(NodeProp.ACT_PUB_ACTOR_ID.s());
			if (ok(userToFollowActorId)) {
				newNode.set(NodeProp.ACT_PUB_ACTOR_ID.s(), userToFollowActorId);
			}

			String userToFollowActorUrl = userNode.getStr(NodeProp.ACT_PUB_ACTOR_URL.s());
			if (ok(userToFollowActorUrl)) {
				newNode.set(NodeProp.ACT_PUB_ACTOR_URL.s(), userToFollowActorUrl);
			}

			apUtil.log("Saved Friend Node (as a Follow): " + XString.prettyPrint(newNode));
			update.save(ms, newNode);

			return newNode;
		} else {
			throw new RuntimeException("User not found: " + userToFollow);
		}
	}

	public AppDropResponse appDrop(MongoSession ms, AppDropRequest req) {
		AppDropResponse res = new AppDropResponse();
		ms = ThreadLocals.ensure(ms);
		String data = req.getData();
		String lcData = data.toLowerCase();

		// for now we only support dropping of links onto our window. I threw in
		// 'file://' but i have no idea
		// if that's going to work or not (yet)
		if (!lcData.startsWith("http://") && !lcData.startsWith("https://") && !lcData.startsWith("file://")) {
			log.info("Drop even ignored: " + data);
			res.setMessage("Sorry, can't drop that there.");
			return res;
		}

		SubNode linksNode = read.getUserNodeByType(ms, ms.getUserName(), null, "### Notes", NodeType.NOTES.s(), null, null);

		if (no(linksNode)) {
			log.warn("unable to get linksNode");
			return null;
		}

		SubNode newNode =
				create.createNode(ms, linksNode, null, NodeType.NONE.s(), 0L, CreateNodeLocation.LAST, null, null, true);

		String title = lcData.startsWith("http") ? Util.extractTitleFromUrl(data) : null;
		String content = ok(title) ? "#### " + title + "\n" : "";
		content += data;
		newNode.setContent(content);
		newNode.touch();
		update.save(ms, newNode);

		res.setMessage("Drop Accepted: Created link to: " + data);
		return res;
	}

	/*
	 * Creates a new node that is a sibling (same parent) of and at the same ordinal position as the
	 * node specified in the request. Should ONLY be called by the controller that accepts a node being
	 * created by the GUI/user
	 */
	public InsertNodeResponse insertNode(MongoSession ms, InsertNodeRequest req) {
		InsertNodeResponse res = new InsertNodeResponse();
		ms = ThreadLocals.ensure(ms);
		String parentNodeId = req.getParentId();
		log.debug("Inserting under parent: " + parentNodeId);
		SubNode parentNode = read.getNode(ms, parentNodeId);
		if (no(parentNode)) {
			throw new RuntimeException("Unable to find parent note to insert under: " + parentNodeId);
		}

		auth.authForChildNodeCreate(ms, parentNode);
		SubNode newNode = create.createNode(ms, parentNode, null, req.getTypeName(), req.getTargetOrdinal(),
				CreateNodeLocation.ORDINAL, null, null, true);

		if (ok(req.getInitialValue())) {
			newNode.setContent(req.getInitialValue());
		} else {
			newNode.setContent("");
		}
		newNode.touch();

		// '/r/p/' = pending (nodes not yet published, being edited created by users)
		if (req.isPendingEdit()) {
			mongoUtil.setPendingPath(newNode, true);
		}

		boolean allowSharing = true;
		if (NodeType.BOOKMARK.s().equals(req.getTypeName())) {
			// adding bookmark should disallow sharing.
			allowSharing = false;
		}

		if (allowSharing) {
			// If we're inserting a node under the POSTS it should be public, rather than inherit.
			// todo-0: some logic shold be common between this insertNode() and the createSubNode()
			if (parentNode.isType(NodeType.POSTS)) {
				acl.addPrivilege(ms, newNode, PrincipalName.PUBLIC.s(),
						Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
			} else {
				// we always copy the access controls from the parent for any new nodes
				auth.setDefaultReplyAcl(null, parentNode, newNode);
			}
		}

		update.save(ms, newNode);
		res.setNewNode(convert.convertToNodeInfo(ThreadLocals.getSC(), ms, newNode, true, false, -1, false, false, false, false));

		// if (req.isUpdateModTime() && !StringUtils.isEmpty(newNode.getContent()) //
		// // don't evern send notifications when 'admin' is the one doing the editing.
		// && !PrincipalName.ADMIN.s().equals(sessionContext.getUserName())) {
		// outboxMgr.sendNotificationForNodeEdit(newNode, sessionContext.getUserName());
		// }

		res.setSuccess(true);
		return res;
	}

	public SaveNodeResponse saveNode(MongoSession _ms, SaveNodeRequest req) {
		SaveNodeResponse res = new SaveNodeResponse();
		// log.debug("Controller saveNode: " + Thread.currentThread().getName());

		_ms = ThreadLocals.ensure(_ms);
		MongoSession ms = _ms;

		NodeInfo nodeInfo = req.getNode();
		String nodeId = nodeInfo.getId();

		// log.debug("saveNode. nodeId=" + XString.prettyPrint(nodeInfo));
		SubNode node = read.getNode(ms, nodeId);
		auth.ownerAuth(ms, node);

		if (no(node)) {
			throw new RuntimeEx("Unable find node to save: nodeId=" + nodeId);
		}

		/* Remember the initial ipfs link */
		String initIpfsLink = node.getStr(NodeProp.IPFS_LINK);

		/*
		 * The only purpose of this limit is to stop hackers from using up lots of space, because our only
		 * current quota is on attachment file size uploads
		 */
		if (ok(nodeInfo.getContent()) && nodeInfo.getContent().length() > 64 * 1024) {
			throw new RuntimeEx("Max text length is 64K");
		}

		node.setContent(nodeInfo.getContent());
		node.touch();
		node.setType(nodeInfo.getType());

		/*
		 * if node name is empty or not valid (canot have ":" in the name) set it to null quietly
		 */
		if (StringUtils.isEmpty(nodeInfo.getName())) {
			node.setName(null);
		}
		// if we're setting node name to a different node name
		else if (ok(nodeInfo.getName()) && nodeInfo.getName().length() > 0 && !nodeInfo.getName().equals(node.getName())) {
			if (!StringUtils.isAlphanumeric(nodeInfo.getName())) {
				throw new RuntimeEx("Node names can only contain alpha numeric characters");
			}
			String nodeName = nodeInfo.getName().trim();

			// if not admin we have to lookup the node with "userName:nodeName" format
			if (!ThreadLocals.getSC().isAdmin()) {
				nodeName = ThreadLocals.getSC().getUserName() + ":" + nodeName;
			}

			/*
			 * We don't use unique index on node name, because it's not worth the performance overhead, so we
			 * have to do the uniqueness check ourselves here manually
			 */
			SubNode nodeByName = read.getNodeByName(ms, nodeName);
			if (ok(nodeByName)) {
				throw new RuntimeEx("Node name is already in use. Duplicates not allowed.");
			}

			node.setName(nodeInfo.getName().trim());
		}

		if (ok(nodeInfo.getProperties())) {
			for (PropertyInfo property : nodeInfo.getProperties()) {

				if ("[null]".equals(property.getValue())) {
					node.delete(property.getName());
				} else {
					/*
					 * save only if server determines the property is savable. Just protection. Client shouldn't be
					 * trying to save stuff that is illegal to save, but we have to assume the worst behavior from
					 * client code, for security and robustness.
					 */
					if (ms.isAdmin() || SubNodeUtil.isSavableProperty(property.getName())) {
						// log.debug("Property to save: " + property.getName() + "=" +
						// property.getValue());
						node.set(property.getName(), property.getValue());
					} else {
						/**
						 * TODO: This case indicates that data was sent unnecessarily. fix! (i.e. make sure this block
						 * cannot ever be entered)
						 */
						log.debug("Ignoring unneeded save attempt on unneeded prop: " + property.getName());
					}
				}
			}
		}

		// If removing encryption, remove it from all the ACL entries too.
		String encKey = node.getStr(NodeProp.ENC_KEY.s());
		if (no(encKey)) {
			mongoUtil.removeAllEncryptionKeys(node);
		}
		/* if node is currently encrypted */
		else {
			res.setAclEntries(auth.getAclEntries(ms, node));
		}

		/*
		 * If we have an IPFS attachment and there's no IPFS_REF property that means it should be pinned.
		 * (IPFS_REF means 'referenced' and external to our server).
		 */
		String ipfsLink = node.getStr(NodeProp.IPFS_LINK);
		if (ok(ipfsLink)) {

			// if there's no 'ref' property this is not a foreign reference, which means we
			// DO pin this.
			if (no(node.getStr(NodeProp.IPFS_REF.s()))) {
				/*
				 * Only if this is the first ipfs link ever added, or is a new link, then we need to pin and update
				 * user quota
				 */
				if (no(initIpfsLink) || !initIpfsLink.equals(ipfsLink)) {
					arun.run(sess -> {
						// don't pass the actual node into here, because it runs in a separate thread and would be
						// a concurrency problem.
						ipfs.ipfsAsyncPinNode(sess, node.getId());
						return null;
					});
				}
			}
			// otherwise we don't pin it.
			else {
				/*
				 * Don't do this removePin. Leave this comment here as a warning of what NOT to do! We can't simply
				 * remove the CID from our IPFS database because some node stopped using it, because there may be
				 * many other users/nodes potentially using it, so we let the releaseOrphanIPFSPins be our only way
				 * pins ever get removed, because that method does a safe and correct delete of all pins that are
				 * truly no longer in use by anyone
				 */
				// ipfs.removePin(ipfsLink);
			}
		}

		/*
		 * If the node being saved is currently in the pending area /p/ then we publish it now, and move it
		 * out of pending.
		 */
		mongoUtil.setPendingPath(node, false);

		String sessionUserName = ThreadLocals.getSC().getUserName();

		/* Send notification to local server or to remote server when a node is added */
		if (!StringUtils.isEmpty(node.getContent()) //
				// don't send notifications when 'admin' is the one doing the editing.
				&& !PrincipalName.ADMIN.s().equals(sessionUserName)) {

			arun.run(s -> {
				HashSet<Integer> sessionsPushed = new HashSet<>();

				// push any chat messages that need to go out.
				push.pushNodeToMonitoringBrowsers(s, sessionsPushed, node);

				SubNode parent = read.getParent(ms, node, false);
				if (ok(parent)) {
					auth.saveMentionsToNodeACL(s, node);

					if (ok(node.getAc())) {

						// Get the inReplyTo from the parent property (foreign node) or if not found generate one based on
						// what the local server version of it is.
						String inReplyTo = parent.getStr(NodeProp.ACT_PUB_OBJ_URL);
						if (no(inReplyTo)) {
							inReplyTo = snUtil.getIdBasedUrl(parent);
						}

						APList attachments = apub.createAttachmentsList(node);
						String nodeUrl = snUtil.getIdBasedUrl(node);

						apub.sendNotificationForNodeEdit(s, inReplyTo, snUtil.cloneAcl(node), attachments, node.getContent(),
								nodeUrl);
						push.pushNodeUpdateToBrowsers(s, sessionsPushed, node);
					}
					return null;
				} else {
					log.error("Unable to find parent node for path: " + node.getPath());
				}
				return null;
			});
		}

		NodeInfo newNodeInfo =
				convert.convertToNodeInfo(ThreadLocals.getSC(), ms, node, true, false, -1, false, false, true, false);
		res.setNode(newNodeInfo);

		// todo-2: for now we only push nodes if public, up to browsers rather than doing a specific check
		// to send only to users who should see it.
		if (AclService.isPublic(ms, node)) {
			push.pushTimelineUpdateToBrowsers(ms, newNodeInfo);
		}

		res.setSuccess(true);
		return res;
	}

	/*
	 * Whenever a friend node is saved, we send the "following" request to the foreign ActivityPub
	 * server
	 */
	public void updateSavedFriendNode(SubNode node) {
		String userNodeId = node.getStr(NodeProp.USER_NODE_ID.s());

		String friendUserName = node.getStr(NodeProp.USER.s());
		if (ok(friendUserName)) {
			// if a foreign user, update thru ActivityPub.
			if (friendUserName.contains("@") && !ThreadLocals.getSC().isAdmin()) {
				apUtil.log("calling setFollowing=true, to post follow to foreign server.");
				String followerUser = ThreadLocals.getSC().getUserName();
				apFollowing.setFollowing(followerUser, friendUserName, true);
			}

			/*
			 * when user first adds, this friendNode won't have the userNodeId yet, so add if not yet existing
			 */
			if (no(userNodeId)) {
				/*
				 * A userName containing "@" is considered a foreign Fediverse user and will trigger a WebFinger
				 * search of them, and a load/update of their outbox
				 */
				if (friendUserName.contains("@")) {
					asyncExec.run(ThreadLocals.getContext(), () -> {
						arun.run(s -> {
							if (!ThreadLocals.getSC().isAdmin()) {
								apub.getAcctNodeByUserName(s, friendUserName);
							}

							/*
							 * The only time we pass true to load the user into the system is when they're being added as a
							 * friend.
							 */
							apub.userEncountered(friendUserName, true);
							return null;
						});
					});
				}

				Val<SubNode> userNode = new Val<SubNode>();
				arun.run(s -> {
					userNode.setVal(read.getUserNodeByUserName(s, friendUserName));
					return null;
				});

				if (ok(userNode.getVal())) {
					userNodeId = userNode.getVal().getIdStr();
					node.set(NodeProp.USER_NODE_ID.s(), userNodeId);
				}
			}
		}
	}

	/*
	 * Removes the property specified in the request from the node specified in the request
	 */
	public DeletePropertyResponse deleteProperties(MongoSession ms, DeletePropertyRequest req) {
		DeletePropertyResponse res = new DeletePropertyResponse();
		ms = ThreadLocals.ensure(ms);
		String nodeId = req.getNodeId();
		SubNode node = read.getNode(ms, nodeId);
		auth.ownerAuthByThread(node);

		for (String propName : req.getPropNames()) {
			node.delete(propName);
		}

		update.save(ms, node);
		res.setSuccess(true);
		return res;
	}

	/*
	 * When user pastes in a large amount of text and wants to have this text broken out into individual
	 * nodes they can pass into here and double spaces become splitpoints, and this splitNode method
	 * will break it all up into individual nodes.
	 */
	public SplitNodeResponse splitNode(MongoSession ms, SplitNodeRequest req) {
		SplitNodeResponse res = new SplitNodeResponse();
		ms = ThreadLocals.ensure(ms);
		String nodeId = req.getNodeId();

		// log.debug("Splitting node: " + nodeId);
		SubNode node = read.getNode(ms, nodeId);
		SubNode parentNode = read.getParent(ms, node);

		auth.ownerAuth(ms, node);
		String content = node.getContent();
		boolean containsDelim = content.contains(req.getDelimiter());

		/*
		 * If split will have no effect, just return as if successful.
		 */
		if (!containsDelim) {
			res.setSuccess(true);
			return res;
		}

		String[] contentParts = StringUtils.splitByWholeSeparator(content, req.getDelimiter());
		SubNode parentForNewNodes = null;
		long firstOrdinal = 0;

		/*
		 * When inserting inline all nodes go in right where the original node is, in order below it as
		 * siblings
		 */
		if (req.getSplitType().equalsIgnoreCase("inline")) {
			parentForNewNodes = parentNode;
			firstOrdinal = node.getOrdinal();
		}
		/*
		 * but for a 'child' insert all new nodes are inserted as children of the original node, starting at
		 * the top (ordinal), regardless of whether this node already has any children or not.
		 */
		else {
			parentForNewNodes = node;
			firstOrdinal = 0L;
		}

		int numNewSlots = contentParts.length - 1;
		if (numNewSlots > 0) {
			create.insertOrdinal(ms, parentForNewNodes, firstOrdinal, numNewSlots);
			update.save(ms, parentForNewNodes);
		}

		int idx = 0;
		for (String part : contentParts) {
			// log.debug("ContentPart[" + idx + "] " + part);
			part = part.trim();
			if (idx == 0) {
				node.setContent(part);
				node.touch();
				update.save(ms, node);
			} else {
				SubNode newNode =
						create.createNode(ms, parentForNewNodes, null, firstOrdinal + idx, CreateNodeLocation.ORDINAL, false);
				newNode.setContent(part);
				newNode.touch();
				update.save(ms, newNode);
			}
			idx++;
		}

		res.setSuccess(true);
		return res;
	}

	public TransferNodeResponse transferNode(MongoSession ms, TransferNodeRequest req) {
		TransferNodeResponse res = new TransferNodeResponse();
		ms = ThreadLocals.ensure(ms);
		int transfers = 0;
		String nodeId = req.getNodeId();

		log.debug("Transfer node: " + nodeId);
		SubNode node = read.getNode(ms, nodeId);
		auth.ownerAuth(ms, node);

		SubNode toUserNode = read.getUserNodeByUserName(auth.getAdminSession(), req.getToUser());
		if (no(toUserNode)) {
			throw new RuntimeEx("User not found: " + req.getToUser());
		}

		SubNode fromUserNode = null;
		if (!StringUtils.isEmpty(req.getFromUser())) {
			fromUserNode = read.getUserNodeByUserName(auth.getAdminSession(), req.getFromUser());
			if (no(fromUserNode)) {
				throw new RuntimeEx("User not found: " + req.getFromUser());
			}
		}

		// if user doesn't specify a 'from' then we set ownership of ALL nodes.
		if (no(fromUserNode)) {
			node.setOwner(toUserNode.getOwner());
			transfers++;
		} else {
			if (transferNode(ms, node, fromUserNode.getOwner(), toUserNode.getOwner())) {
				transfers++;
			}
		}

		if (req.isRecursive()) {
			for (SubNode n : read.getSubGraph(ms, node, null, 0, true)) {
				// log.debug("Node: path=" + path + " content=" + n.getContent());
				if (no(fromUserNode)) {
					n.setOwner(toUserNode.getOwner());
					transfers++;
				} else {
					if (transferNode(ms, n, fromUserNode.getOwner(), toUserNode.getOwner())) {
						transfers++;
					}
				}
			}
		}

		if (transfers > 0) {
			update.saveSession(auth.getAdminSession());
		}

		res.setMessage(String.valueOf(transfers) + " nodes were transferred.");
		res.setSuccess(true);
		return res;
	}

	/* Returns true if a transfer was done */
	public boolean transferNode(MongoSession ms, SubNode node, ObjectId fromUserObjId, ObjectId toUserObjId) {
		/* is this a node we are transferring */
		if (fromUserObjId.equals(node.getOwner())) {
			node.setOwner(toUserObjId);
			return true;
		}
		return false;
	}

	/*
	 * This makes ALL the headings of all the sibling nodes match the heading level of the req.nodeId
	 * passed in.
	 */
	public UpdateHeadingsResponse updateHeadings(MongoSession ms, UpdateHeadingsRequest req) {
		UpdateHeadingsResponse res = new UpdateHeadingsResponse();
		ms = ThreadLocals.ensure(ms);

		SubNode node = read.getNode(ms, req.getNodeId(), true);
		String content = node.getContent();
		if (ok(content)) {
			content = content.trim();
			int baseLevel = XString.getHeadingLevel(content);

			SubNode parent = read.getParent(ms, node);
			if (ok(parent)) {
				for (SubNode n : read.getChildren(ms, parent)) {
					updateHeadingsForNode(ms, n, baseLevel);
				}
				update.saveSession(ms);
			}
		}
		return res;
	}

	private void updateHeadingsForNode(MongoSession ms, SubNode node, int level) {
		if (no(node))
			return;

		String nodeContent = node.getContent();
		String content = nodeContent;
		if (no(content))
			return;

		// if this node starts with a heading (hash marks)
		if (content.startsWith("#") && content.indexOf(" ") < 7) {
			int spaceIdx = content.indexOf(" ");
			if (spaceIdx != -1) {

				// strip the pre-existing hashes off
				content = content.substring(spaceIdx + 1);

				/*
				 * These strings (pound sign headings) could be generated dynamically, but this switch with them
				 * hardcoded is more performant
				 */
				switch (level) {
					case 0: // this will be the root node (user selected node)
						break;
					case 1:
						if (!nodeContent.startsWith("# ")) {
							node.setContent("# " + content);
						}
						break;
					case 2:
						if (!nodeContent.startsWith("## ")) {
							node.setContent("## " + content);
						}
						break;
					case 3:
						if (!nodeContent.startsWith("### ")) {
							node.setContent("### " + content);
						}
						break;
					case 4:
						if (!nodeContent.startsWith("#### ")) {
							node.setContent("#### " + content);
						}
						break;
					case 5:
						if (!nodeContent.startsWith("##### ")) {
							node.setContent("##### " + content);
						}
						break;
					case 6:
						if (!nodeContent.startsWith("###### ")) {
							node.setContent("###### " + content);
						}
						break;
					default:
						break;
				}
			}
		}
	}

	public SearchAndReplaceResponse searchAndReplace(MongoSession ms, SearchAndReplaceRequest req) {
		SearchAndReplaceResponse res = new SearchAndReplaceResponse();
		ms = ThreadLocals.ensure(ms);
		int replacements = 0;
		String nodeId = req.getNodeId();

		// log.debug("searchingAndReplace node: " + nodeId);
		SubNode node = read.getNode(ms, nodeId);
		auth.ownerAuth(ms, node);

		if (replaceText(ms, node, req.getSearch(), req.getReplace())) {
			replacements++;
		}

		if (req.isRecursive()) {
			for (SubNode n : read.getSubGraph(ms, node, null, 0, true)) {
				if (replaceText(ms, n, req.getSearch(), req.getReplace())) {
					replacements++;
				}
			}
		}

		if (replacements > 0) {
			update.saveSession(ms);
		}

		res.setMessage(String.valueOf(replacements) + " nodes were updated.");
		res.setSuccess(true);
		return res;
	}

	private boolean replaceText(MongoSession ms, SubNode node, String search, String replace) {
		String content = node.getContent();
		if (no(content))
			return false;
		if (content.contains(search)) {
			node.setContent(content.replace(search, replace));
			node.touch();
			return true;
		}
		return false;
	}
}
