package org.subnode.service;

import java.util.Calendar;

import org.subnode.config.NodeName;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.config.SessionContext;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.mail.OutboxMgr;
import org.subnode.model.NodeInfo;
import org.subnode.model.PropertyInfo;
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoThreadLocal;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.AppDropRequest;
import org.subnode.request.CreateSubNodeRequest;
import org.subnode.request.DeletePropertyRequest;
import org.subnode.request.InsertNodeRequest;
import org.subnode.request.SaveNodeRequest;
import org.subnode.request.SavePropertyRequest;
import org.subnode.request.SplitNodeRequest;
import org.subnode.request.TransferNodeRequest;
import org.subnode.response.AppDropResponse;
import org.subnode.response.CreateSubNodeResponse;
import org.subnode.response.DeletePropertyResponse;
import org.subnode.response.InsertNodeResponse;
import org.subnode.response.SaveNodeResponse;
import org.subnode.response.SavePropertyResponse;
import org.subnode.response.SplitNodeResponse;
import org.subnode.response.TransferNodeResponse;
import org.subnode.util.Convert;
import org.subnode.util.ExUtil;
import org.subnode.util.Util;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.ThreadLocals;

import opennlp.tools.util.StringUtil;

import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

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
	private MongoApi api;

	@Autowired
	private SubNodeUtil apiUtil;

	@Autowired
	private SessionContext sessionContext;

	@Autowired
	private OutboxMgr outboxMgr;

	/*
	 * Creates a new node as a *child* node of the node specified in the request.
	 */
	public CreateSubNodeResponse createSubNode(MongoSession session, CreateSubNodeRequest req) {
		CreateSubNodeResponse res = new CreateSubNodeResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		MongoThreadLocal.setAutoTimestampDisabled(true);

		String nodeId = req.getNodeId();
		SubNode node = null;
		if (nodeId.equals("~notes")) {
			node = api.getSpecialNode(session, session.getUser(), null, NodeName.NOTES, "### Notes", NodeType.NOTES.s());
		} else {
			node = api.getNode(session, nodeId);
		}
		SubNode newNode = null;

		CreateNodeLocation createLoc = req.isCreateAtTop() ? CreateNodeLocation.FIRST : CreateNodeLocation.LAST;
		newNode = api.createNode(session, node, null, req.getTypeName(), 0L, createLoc);
		newNode.setContent(req.getContent() != null ? req.getContent() : "");

		api.save(session, newNode);
		res.setNewNode(convert.convertToNodeInfo(sessionContext, session, newNode, true, true, false, -1, false, false,
				false));
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

		SubNode linksNode = api.getSpecialNode(session, session.getUser(), null, NodeName.NOTES, "### Notes", NodeType.NOTES.s());

		SubNode newNode = api.createNode(session, linksNode, null, NodeType.NONE.s(), 0L,
				CreateNodeLocation.LAST);

		String title = lcData.startsWith("http") ? Util.extractTitleFromUrl(data) : null;
		String content = title != null ? "#### " + title + "\n" : "";
		content += data;
		newNode.setContent(content);

		api.save(session, newNode);

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
		SubNode parentNode = api.getNode(session, parentNodeId);

		SubNode newNode = api.createNode(session, parentNode, null, req.getTypeName(), req.getTargetOrdinal(),
				CreateNodeLocation.ORDINAL);
		newNode.setContent("");

		/* When a user creates a new node we use "ModTime==0" (never modified) as a way to indicate the node is in 'draft mode',
		and should not be visible to other users until "Save" is clicked. */
		MongoThreadLocal.setAutoTimestampDisabled(true);

		api.save(session, newNode);
		res.setNewNode(convert.convertToNodeInfo(sessionContext, session, newNode, true, true, false, -1, false, false,
				false));
		res.setSuccess(true);
		return res;
	}

	/*
	 * Saves the value(s) of properties on the node specified in the request.
	 */
	public SavePropertyResponse saveProperty(MongoSession session, SavePropertyRequest req) {
		SavePropertyResponse res = new SavePropertyResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		String nodeId = req.getNodeId();
		SubNode node = api.getNode(session, nodeId);
		node.setProp(req.getPropertyName(), req.getPropertyValue());
		api.save(session, node);

		PropertyInfo propertySaved = new PropertyInfo(req.getPropertyName(), req.getPropertyValue());
		res.setPropertySaved(propertySaved);
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

		//log.debug("saveNode. nodeId=" + nodeId + " nodeName=" + nodeInfo.getName());
		SubNode node = api.getNode(session, nodeId);
		api.authRequireOwnerOfNode(session, node);

		if (node == null) {
			throw new RuntimeEx("Unable find node to save: nodeId=" + nodeId);
		}

		/*
		 * The only purpose of this limit is to stop hackers from using up lots of
		 * space, because our only current quota is on attachment file size uploads
		 */
		if (nodeInfo.getContent().length() > 64 * 1024) {
			throw new RuntimeEx("Max text length is 64K");
		}

		node.setContent(nodeInfo.getContent());
		node.setType(nodeInfo.getType());

		// if we're setting node name to a different node name
		if (nodeInfo.getName() != null && nodeInfo.getName().length() > 0
				&& !nodeInfo.getName().equals(node.getName())) {

			/*
			 * We don't use unique index on node name, because we want to save storage space
			 * on the server, so we have to do the uniqueness check ourselves here manually
			 */
			SubNode nodeByName = api.getNodeByName(session, nodeInfo.getName());
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

			// If removing encryption, remove it from all the ACL entries too.
			String encKey = node.getStringProp(NodeProp.ENC_KEY.s());
			if (encKey == null) {
				api.removeAllEncryptionKeys(node);
			}
			/* if adding entryption to this node, and the node wasn't currently encrypted */
			else {
				res.setAclEntries(api.getAclEntries(session, node));
			}

			Calendar lastModified = Calendar.getInstance();
			node.setModifyTime(lastModified.getTime());

			if (!StringUtil.isEmpty(node.getContent())) {
				outboxMgr.sendNotificationForNodeEdit(node, sessionContext.getUserName());
			}

			NodeInfo newNodeInfo = convert.convertToNodeInfo(sessionContext, session, node, true, true, false, -1,
					false, false, false);
			res.setNode(newNodeInfo);
			api.saveSession(session);
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
		SubNode node = api.getNode(session, nodeId);
		String propertyName = req.getPropName();
		node.deleteProp(propertyName);
		api.save(session, node);
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
		SubNode node = api.getNode(session, nodeId);
		SubNode parentNode = api.getParent(session, node);

		api.authRequireOwnerOfNode(session, node);

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
			api.insertOrdinal(session, parentForNewNodes, firstOrdinal, numNewSlots);
			api.save(session, parentForNewNodes);
		}

		int idx = 0;
		for (String part : contentParts) {
			if (idx == 0) {
				node.setContent(part);
				api.save(session, node);
			} else {
				SubNode newNode = api.createNode(session, parentForNewNodes, null, firstOrdinal + idx,
						CreateNodeLocation.ORDINAL);
				newNode.setContent(part);
				api.save(session, newNode);
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
		SubNode node = api.getNode(session, nodeId);
		api.authRequireOwnerOfNode(session, node);

		SubNode toUserNode = api.getUserNodeByUserName(api.getAdminSession(), req.getToUser());
		if (toUserNode == null) {
			throw new RuntimeEx("User not found: " + req.getToUser());
		}

		SubNode fromUserNode = api.getUserNodeByUserName(api.getAdminSession(), req.getFromUser());
		if (fromUserNode == null) {
			throw new RuntimeEx("User not found: " + req.getFromUser());
		}
		if (transferNode(session, node, fromUserNode.getOwner(), toUserNode.getOwner())) {
			transfers++;
		}

		if (req.isRecursive()) {
			/*
			 * todo-1: It would be more performant to build the
			 * "fromUserObjId.equals(toUserObjId)" condition into the query itself and let
			 * MongoDB to the filtering for us
			 */
			for (SubNode n : api.getSubGraph(session, node)) {
				// log.debug("Node: path=" + path + " content=" + n.getContent());
				if (transferNode(session, n, fromUserNode.getOwner(), toUserNode.getOwner())) {
					transfers++;
				}
			}
		}

		if (transfers > 0) {
			api.saveSession(session);
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
}
