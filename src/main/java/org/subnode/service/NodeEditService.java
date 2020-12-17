package org.subnode.service;

import java.util.Date;

import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.subnode.config.AppProp;
import org.subnode.config.SessionContext;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.mail.OutboxMgr;
import org.subnode.model.NodeInfo;
import org.subnode.model.PropertyInfo;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.model.client.PrincipalName;
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoCreate;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.AppDropRequest;
import org.subnode.request.CreateSubNodeRequest;
import org.subnode.request.DeletePropertyRequest;
import org.subnode.request.InsertNodeRequest;
import org.subnode.request.SaveNodeRequest;
import org.subnode.request.SplitNodeRequest;
import org.subnode.request.TransferNodeRequest;
import org.subnode.request.UpdateHeadingsRequest;
import org.subnode.response.AppDropResponse;
import org.subnode.response.CreateSubNodeResponse;
import org.subnode.response.DeletePropertyResponse;
import org.subnode.response.InsertNodeResponse;
import org.subnode.response.SaveNodeResponse;
import org.subnode.response.SplitNodeResponse;
import org.subnode.response.TransferNodeResponse;
import org.subnode.response.UpdateHeadingsResponse;
import org.subnode.util.Convert;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.Util;
import org.subnode.util.ValContainer;
import org.subnode.util.XString;

/**
 * Service for editing content of nodes. That is, this method updates property
 * values of JCR nodes. As the user is using the application and moving,
 * copy+paste, or editing node content this is the service that performs those
 * operations on the server, directly called from the HTML 'controller'
 */
@Component
public class NodeEditService {
	private static final Logger log = LoggerFactory.getLogger(NodeEditService.class);

	@Autowired
	private Convert convert;

	@Autowired
	private MongoUtil util;

	@Autowired
	private MongoCreate create;

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoUpdate update;

	@Autowired
	private SessionContext sessionContext;

	@Autowired
	private OutboxMgr outboxMgr;

	@Autowired
	private UserFeedService userFeedService;

	@Autowired
	private RunAsMongoAdmin adminRunner;

	@Autowired
	private ActPubService actPubService;

	@Autowired
	private AppProp appProp;

	@Autowired
	private MongoAuth auth;

	/*
	 * Creates a new node as a *child* node of the node specified in the request.
	 */
	public CreateSubNodeResponse createSubNode(MongoSession session, CreateSubNodeRequest req) {
		CreateSubNodeResponse res = new CreateSubNodeResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		String nodeId = req.getNodeId();
		SubNode node = null;
		if (nodeId.equals("~notes")) {
			node = read.getUserNodeByType(session, session.getUser(), null, "### Notes", NodeType.NOTES.s());
		} else {
			node = read.getNode(session, nodeId);
		}
		if (node == null) {
			res.setMessage("unable to locate parent for insert");
			res.setSuccess(false);
			return res;
		}

		/*
		 * We have this hack (until the privileges are more nuanced, or updated) which
		 * verifies if someone is inserting under a USER_FEED node we don't allow it
		 * unless its' the person who OWNS the USER_FEED, and we have this check because
		 * right now our design is that USER_FEED nodes are by definition automatically
		 * 'public'
		 */
		if (node.getType().equals(NodeType.USER_FEED.s())
				&& !sessionContext.getRootId().equals(node.getOwner().toHexString())) {
			res.setMessage("You aren't allowed to create a node here.");
			res.setSuccess(false);
			return res;
		}

		CreateNodeLocation createLoc = req.isCreateAtTop() ? CreateNodeLocation.FIRST : CreateNodeLocation.LAST;

		SubNode newNode = create.createNode(session, node, null, req.getTypeName(), 0L, createLoc, req.getProperties());

		if (!req.isUpdateModTime()) {
			newNode.setModifyTime(null);
		}

		newNode.setContent(req.getContent() != null ? req.getContent() : "");

		if (req.isPrivateReply()) {
			newNode.setProp(NodeProp.ACT_PUB_PRIVATE.s(), Boolean.valueOf(true));
		}

		if (req.isTypeLock()) {
			newNode.setProp(NodeProp.TYPE_LOCK.s(), Boolean.valueOf(true));
		}

		update.save(session, newNode);
		res.setNewNode(convert.convertToNodeInfo(sessionContext, session, newNode, true, false, -1, false, false));

		if (newNode.getType().equals(NodeType.USER_FEED.s())) {
			userFeedService.addUserFeedInfo(session, newNode, null, sessionContext.getUserName());
		}

		res.setSuccess(true);
		return res;
	}

	public AppDropResponse appDrop(MongoSession session, AppDropRequest req) {
		AppDropResponse res = new AppDropResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
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

		SubNode linksNode = read.getUserNodeByType(session, session.getUser(), null, "### Notes", NodeType.NOTES.s());

		if (linksNode == null) {
			log.warn("unable to get linksNode");
			return null;
		}

		SubNode newNode = create.createNode(session, linksNode, null, NodeType.NONE.s(), 0L, CreateNodeLocation.LAST,
				null);

		String title = lcData.startsWith("http") ? Util.extractTitleFromUrl(data) : null;
		String content = title != null ? "#### " + title + "\n" : "";
		content += data;
		newNode.setContent(content);

		update.save(session, newNode);

		res.setMessage("Drop Accepted: Created link to: " + data);
		return res;
	}

	/*
	 * Creates a new node that is a sibling (same parent) of and at the same ordinal
	 * position as the node specified in the request.
	 */
	public InsertNodeResponse insertNode(MongoSession session, InsertNodeRequest req) {
		InsertNodeResponse res = new InsertNodeResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		String parentNodeId = req.getParentId();
		log.debug("Inserting under parent: " + parentNodeId);
		SubNode parentNode = read.getNode(session, parentNodeId);

		/*
		 * We have this hack (until the privileges are more nuanced, or updated) which
		 * verifies if someone is inserting under a USER_FEED node we don't allow it
		 * unless its' the person who OWNS the USER_FEED, and we have this check because
		 * right now our design is that USER_FEED nodes are by definition automatically
		 * 'public'
		 */
		if (parentNode.getType().equals(NodeType.USER_FEED.s())
				&& !sessionContext.getRootId().equals(parentNode.getOwner().toHexString())) {
			res.setMessage("You aren't allowed to create a node here.");
			res.setSuccess(false);
			return res;
		}

		SubNode newNode = create.createNode(session, parentNode, null, req.getTypeName(), req.getTargetOrdinal(),
				CreateNodeLocation.ORDINAL, null);

		if (req.getInitialValue() != null) {
			newNode.setContent(req.getInitialValue());
		} else {
			newNode.setContent("");
		}

		if (!req.isUpdateModTime()) {
			newNode.setModifyTime(null);
		}

		update.save(session, newNode);
		res.setNewNode(convert.convertToNodeInfo(sessionContext, session, newNode, true, false, -1, false, false));

		if (req.isUpdateModTime() && !StringUtils.isEmpty(newNode.getContent()) //
		// don't evern send notifications when 'admin' is the one doing the editing.
				&& !PrincipalName.ADMIN.s().equals(sessionContext.getUserName())) {
			outboxMgr.sendNotificationForNodeEdit(newNode, sessionContext.getUserName());
		}

		if (newNode.getType().equals(NodeType.USER_FEED.s())) {
			userFeedService.addUserFeedInfo(session, newNode, null, sessionContext.getUserName());
		}

		res.setSuccess(true);
		return res;
	}

	public SaveNodeResponse saveNode(MongoSession session, SaveNodeRequest req) {
		SaveNodeResponse res = new SaveNodeResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		NodeInfo nodeInfo = req.getNode();
		String nodeId = nodeInfo.getId();

		// log.debug("saveNode. nodeId=" + XString.prettyPrint(nodeInfo));
		SubNode node = read.getNode(session, nodeId);
		auth.authRequireOwnerOfNode(session, node);

		if (node == null) {
			throw new RuntimeEx("Unable find node to save: nodeId=" + nodeId);
		}

		/*
		 * The only purpose of this limit is to stop hackers from using up lots of
		 * space, because our only current quota is on attachment file size uploads
		 */
		if (nodeInfo.getContent() != null && nodeInfo.getContent().length() > 64 * 1024) {
			throw new RuntimeEx("Max text length is 64K");
		}

		node.setContent(nodeInfo.getContent());
		node.setType(nodeInfo.getType());
		String curFollowing = node.getStrProp(NodeProp.ACT_PUB_FOLLOWING.s());

		if (StringUtils.isEmpty(nodeInfo.getName())) {
			node.setName(null);
		}
		// if we're setting node name to a different node name
		else if (nodeInfo.getName() != null && nodeInfo.getName().length() > 0
				&& !nodeInfo.getName().equals(node.getName())) {

			/*
			 * We don't use unique index on node name, because we want to save storage space
			 * on the server, so we have to do the uniqueness check ourselves here manually
			 */
			SubNode nodeByName = read.getNodeByName(session, nodeInfo.getName());
			if (nodeByName != null) {
				throw new RuntimeEx("Node name is already in use. Duplicates not allowed.");
			}

			node.setName(nodeInfo.getName());
		}

		if (nodeInfo.getProperties() != null) {
			for (PropertyInfo property : nodeInfo.getProperties()) {

				if ("[null]".equals(property.getValue())) {
					node.deleteProp(property.getName());
				} else {
					/*
					 * save only if server determines the property is savable. Just protection.
					 * Client shouldn't be trying to save stuff that is illegal to save, but we have
					 * to assume the worst behavior from client code, for security and robustness.
					 */
					if (session.isAdmin() || SubNodeUtil.isSavableProperty(property.getName())) {
						// log.debug("Property to save: " + property.getName() + "=" +
						// property.getValue());
						node.setProp(property.getName(), property.getValue());
					} else {
						/**
						 * TODO: This case indicates that data was sent unnecessarily. fix! (i.e. make
						 * sure this block cannot ever be entered)
						 */
						// log.debug("Ignoring unneeded save attempt on unneeded
						// prop: " + property.getName());
					}
				}
			}
		}

		// If removing encryption, remove it from all the ACL entries too.
		String encKey = node.getStrProp(NodeProp.ENC_KEY.s());
		if (encKey == null) {
			util.removeAllEncryptionKeys(node);
		}
		/* if node is currently encrypted */
		else {
			res.setAclEntries(auth.getAclEntries(session, node));
		}

		if (!req.isUpdateModTime()) {
			node.setModifyTime(null);
		}

		/* Send notification to local server or to remote server when a node is added */
		if (req.isUpdateModTime() && !StringUtils.isEmpty(node.getContent()) //
		// don't evern send notifications when 'admin' is the one doing the editing.
				&& !PrincipalName.ADMIN.s().equals(sessionContext.getUserName())) {

			SubNode parent = read.getNode(session, node.getParentPath(), false);

			/*
			 * If we are saving a node under an ActivityPub item then we need to send a
			 * notification to the owner of this node who will, by definition, be a foreign
			 * user.
			 */
			if (req.isUpdateModTime() && parent != null && (parent.hasProperty(NodeProp.ACT_PUB_ID)
					|| parent.isType(NodeType.ACT_PUB_ITEM) || parent.isForeignFriendNode())) {
				actPubService.sendNotificationForNodeEdit(parent, node);
			} else {
				outboxMgr.sendNotificationForNodeEdit(node, sessionContext.getUserName());
			}
		}

		NodeInfo newNodeInfo = convert.convertToNodeInfo(sessionContext, session, node, true, false, -1, false, false);
		res.setNode(newNodeInfo);

		// todo-1: eventually we need a plugin-type architecture to decouple this kind
		// of type-specific code from the general node saving.
		if (node.getType().equals(NodeType.FRIEND.s())) {
			String userNodeId = node.getStrProp(NodeProp.USER_NODE_ID.s());
			String following = nodeInfo.getPropVal(NodeProp.ACT_PUB_FOLLOWING.s());

			if (curFollowing == null)
				curFollowing = "";
			if (following == null)
				following = "";

			/* if 'following' has changed send message to the server */
			if (!curFollowing.equals(following)) {
				actPubService.setFollowing(node.getStrProp(NodeProp.USER.s()), following.equals("true"));
			}	

			/*
			 * when user first adds, this friendNode won't have the userNodeId yet, so add
			 * if not yet existing
			 */
			if (userNodeId == null) {
				String friendUserName = node.getStrProp(NodeProp.USER.s());

				// if USER_NODE_ID has not been set on the node yet then get it and set it first
				// here.
				if (friendUserName != null) {
					/*
					 * A userName containing "@" is considered a foreign Fediverse user and will
					 * trigger a WebFinger search of them, and a load/update of their outbox
					 */
					if (friendUserName.contains("@")) {
						adminRunner.run(s -> {
							actPubService.loadForeignUser(s, friendUserName);
						});
					}

					ValContainer<SubNode> _userNode = new ValContainer<SubNode>();
					final String _userName = friendUserName;
					adminRunner.run(s -> {
						_userNode.setVal(read.getUserNodeByUserName(s, _userName));
					});

					if (_userNode.getVal() != null) {
						userNodeId = _userNode.getVal().getId().toHexString();
						node.setProp(NodeProp.USER_NODE_ID.s(), userNodeId);
					}
				}
			}
		}

		res.setSuccess(true);
		return res;
	}

	/*
	 * Removes the property specified in the request from the node specified in the
	 * request
	 */
	public DeletePropertyResponse deleteProperty(MongoSession session, DeletePropertyRequest req) {
		DeletePropertyResponse res = new DeletePropertyResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		String nodeId = req.getNodeId();
		SubNode node = read.getNode(session, nodeId);
		String propertyName = req.getPropName();
		node.deleteProp(propertyName);
		update.save(session, node);
		res.setSuccess(true);
		return res;
	}

	/*
	 * When user pastes in a large amount of text and wants to have this text broken
	 * out into individual nodes they can pass into here and double spaces become
	 * splitpoints, and this splitNode method will break it all up into individual
	 * nodes.
	 */
	public SplitNodeResponse splitNode(MongoSession session, SplitNodeRequest req) {
		SplitNodeResponse res = new SplitNodeResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		String nodeId = req.getNodeId();

		// log.debug("Splitting node: " + nodeId);
		SubNode node = read.getNode(session, nodeId);
		SubNode parentNode = read.getParent(session, node);

		auth.authRequireOwnerOfNode(session, node);
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
		 * When inserting inline all nodes go in right where the original node is, in
		 * order below it as siblings
		 */
		if (req.getSplitType().equalsIgnoreCase("inline")) {
			parentForNewNodes = parentNode;
			firstOrdinal = node.getOrdinal();
		}
		/*
		 * but for a 'child' insert all new nodes are inserted as children of the
		 * original node, starting at the top (ordinal), regardless of whether this node
		 * already has any children or not.
		 */
		else {
			parentForNewNodes = node;
			firstOrdinal = 0L;
		}

		int numNewSlots = contentParts.length - 1;
		if (numNewSlots > 0) {
			create.insertOrdinal(session, parentForNewNodes, firstOrdinal, numNewSlots);
			update.save(session, parentForNewNodes);
		}

		Date now = new Date();
		int idx = 0;
		for (String part : contentParts) {
			// log.debug("ContentPart[" + idx + "] " + part);
			part = part.trim();
			if (idx == 0) {
				node.setContent(part);
				node.setModifyTime(now);
				update.save(session, node);
			} else {
				SubNode newNode = create.createNode(session, parentForNewNodes, null, firstOrdinal + idx,
						CreateNodeLocation.ORDINAL);
				newNode.setContent(part);
				update.save(session, newNode);
			}
			idx++;
		}

		res.setSuccess(true);
		return res;
	}

	public TransferNodeResponse transferNode(MongoSession session, TransferNodeRequest req) {
		TransferNodeResponse res = new TransferNodeResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		int transfers = 0;
		String nodeId = req.getNodeId();

		log.debug("Transfer node: " + nodeId);
		SubNode node = read.getNode(session, nodeId);
		auth.authRequireOwnerOfNode(session, node);

		SubNode toUserNode = read.getUserNodeByUserName(auth.getAdminSession(), req.getToUser());
		if (toUserNode == null) {
			throw new RuntimeEx("User not found: " + req.getToUser());
		}

		SubNode fromUserNode = null;
		if (!StringUtils.isEmpty(req.getFromUser())) {
			fromUserNode = read.getUserNodeByUserName(auth.getAdminSession(), req.getFromUser());
			if (fromUserNode == null) {
				throw new RuntimeEx("User not found: " + req.getFromUser());
			}
		}

		// if user doesn't specify a 'from' then we set ownership of ALL nodes.
		if (fromUserNode == null) {
			node.setOwner(toUserNode.getOwner());
			transfers++;
		} else {
			if (transferNode(session, node, fromUserNode.getOwner(), toUserNode.getOwner())) {
				transfers++;
			}
		}

		if (req.isRecursive()) {
			/*
			 * todo-1: It would be more performant to build the
			 * "fromUserObjId.equals(toUserObjId)" condition into the query itself and let
			 * MongoDB to the filtering for us
			 */
			for (SubNode n : read.getSubGraph(session, node)) {
				// log.debug("Node: path=" + path + " content=" + n.getContent());
				if (fromUserNode == null) {
					n.setOwner(toUserNode.getOwner());
					transfers++;
				} else {
					if (transferNode(session, n, fromUserNode.getOwner(), toUserNode.getOwner())) {
						transfers++;
					}
				}
			}
		}

		if (transfers > 0) {
			update.saveSession(session);
		}

		res.setMessage(String.valueOf(transfers) + " nodes were transferred.");
		res.setSuccess(true);
		return res;
	}

	/* Returns true if a transfer was done */
	public boolean transferNode(MongoSession session, SubNode node, ObjectId fromUserObjId, ObjectId toUserObjId) {
		/* is this a node we are transferring */
		if (fromUserObjId.equals(node.getOwner())) {
			node.setOwner(toUserObjId);
			return true;
		}
		return false;
	}

	public UpdateHeadingsResponse updateHeadings(MongoSession session, UpdateHeadingsRequest req) {
		UpdateHeadingsResponse res = new UpdateHeadingsResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		SubNode node = read.getNode(session, req.getNodeId(), true);
		String content = node.getContent();
		int baseLevel = XString.getHeadingLevel(content);
		updateHeadingsRecurseNode(session, node, 0, baseLevel < 0 ? 0 : baseLevel);
		return res;
	}

	/*
	 * todo-1: update to use subgraph query and then just use the slash-count in the
	 * path to determine relative tree level here. Relative part being important of
	 * course.
	 */
	private void updateHeadingsRecurseNode(MongoSession session, SubNode node, int level, int baseLevel) {
		if (node == null)
			return;

		String nodeContent = node.getContent();
		String content = nodeContent;
		if (content.startsWith("#") && content.indexOf(" ") < 7) {
			int spaceIdx = content.indexOf(" ");
			if (spaceIdx != -1) {
				content = content.substring(spaceIdx + 1);

				/*
				 * These strings (pound sign headings) could be generated dynamically, but this
				 * switch with them hardcoded is more performant
				 */
				switch (level + baseLevel) {
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

		Sort sort = Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL);
		for (SubNode n : read.getChildren(session, node, sort, null, 0)) {
			updateHeadingsRecurseNode(session, n, level + 1, baseLevel);
		}

		update.saveSession(session);
	}
}
