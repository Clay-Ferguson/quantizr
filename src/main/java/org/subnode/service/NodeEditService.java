package org.subnode.service;

import java.util.Calendar;

import org.subnode.config.NodeName;
import org.subnode.config.SessionContext;
import org.subnode.mail.OutboxMgr;
import org.subnode.model.NodeInfo;
import org.subnode.model.PropertyInfo;
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.mongo.model.SubNodeTypes;
import org.subnode.mongo.model.types.AllSubNodeTypes;
import org.subnode.request.AppDropRequest;
import org.subnode.request.CreateSubNodeRequest;
import org.subnode.request.DeletePropertyRequest;
import org.subnode.request.InsertNodeRequest;
import org.subnode.request.SaveNodeRequest;
import org.subnode.request.SavePropertyRequest;
import org.subnode.request.SetNodeTypeRequest;
import org.subnode.request.SplitNodeRequest;
import org.subnode.response.AppDropResponse;
import org.subnode.response.CreateSubNodeResponse;
import org.subnode.response.DeletePropertyResponse;
import org.subnode.response.InsertNodeResponse;
import org.subnode.response.SaveNodeResponse;
import org.subnode.response.SavePropertyResponse;
import org.subnode.response.SetNodeTypeResponse;
import org.subnode.response.SplitNodeResponse;
import org.subnode.util.Convert;
import org.subnode.util.ExUtil;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.ThreadLocals;

import org.apache.commons.lang3.StringUtils;
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

	private static final String SPLIT_TAG1 = "{split}";
	private static final String SPLIT_TAG2 = "\n\n\n"; // splits at double-spacing in the text.

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

	@Autowired
	private AllSubNodeTypes TYPES;

	/*
	 * Creates a new node as a *child* node of the node specified in the request.
	 */
	public void createSubNode(MongoSession session, CreateSubNodeRequest req, CreateSubNodeResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		String nodeId = req.getNodeId();
		SubNode node = api.getNode(session, nodeId);
		SubNode newNode = null;

		CreateNodeLocation createLoc = req.isCreateAtTop() ? CreateNodeLocation.FIRST : CreateNodeLocation.LAST;
		newNode = api.createNode(session, node, null, req.getTypeName(), 0L, createLoc);
		newNode.setContent("");

		api.save(session, newNode);
		res.setNewNode(convert.convertToNodeInfo(sessionContext, session, newNode, true, true, false, -1, false, false,
				false));
		res.setSuccess(true);
	}

	public void appDrop(MongoSession session, AppDropRequest req, AppDropResponse res) {
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
			return;
		}

		String userNodeHexId = session.getUserNode().getId().toHexString();
		SubNode linksNode = apiUtil.ensureNodeExists(session,
				"/" + NodeName.ROOT + "/" + NodeName.USER + "/" + userNodeHexId + "/", NodeName.LINKS, "### Links",
				null, true, null, null);

		SubNode newNode = api.createNode(session, linksNode, null, SubNodeTypes.UNSTRUCTURED, 0L,
				CreateNodeLocation.LAST);

		String title = lcData.startsWith("http") ? ExUtil.extractTitleFromUrl(data) : null;
		String content = title != null ? "#### " + title + "\n" : "";
		content += data;
		newNode.setContent(content);

		api.save(session, newNode);

		res.setMessage("Drop Accepted: Created link to: " + data);
	}

	/*
	 * Creates a new node that is a sibling (same parent) of and at the same ordinal
	 * position as the node specified in the request.
	 */
	public void insertNode(MongoSession session, InsertNodeRequest req, InsertNodeResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		String parentNodeId = req.getParentId();
		log.debug("Inserting under parent: " + parentNodeId);
		SubNode parentNode = api.getNode(session, parentNodeId);

		// if (req.getTypeName().equals(SubNodeTypes.FS_FILE) ||
		// req.getTypeName().equals(SubNodeTypes.FS_FOLDER)) {
		// log.debug("FS Create: " + req.getNewNodeName());
		// } else {
		SubNode newNode = api.createNode(session, parentNode, null, req.getTypeName(), req.getTargetOrdinal(),
				CreateNodeLocation.ORDINAL);
		newNode.setContent("");

		api.save(session, newNode);
		res.setNewNode(convert.convertToNodeInfo(sessionContext, session, newNode, true, true, false, -1, false, false,
				false));
		// }
		res.setSuccess(true);
	}

	/*
	 * Saves the value(s) of properties on the node specified in the request.
	 */
	public void saveProperty(MongoSession session, SavePropertyRequest req, SavePropertyResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		String nodeId = req.getNodeId();
		SubNode node = api.getNode(session, nodeId);
		node.setProp(req.getPropertyName(), req.getPropertyValue());
		api.save(session, node);

		PropertyInfo propertySaved = new PropertyInfo(req.getPropertyName(), req.getPropertyValue(), false);
		res.setPropertySaved(propertySaved);
		res.setSuccess(true);
	}

	public void setNodeType(MongoSession session, SetNodeTypeRequest req, SetNodeTypeResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		String nodeId = req.getNodeId();
		SubNode node = api.getNode(session, nodeId);
		node.setType(req.getType());

		// This is a hack for now, to ensure certain subproperties exist on nodes of
		// those types, but there will eventually be
		// a pluggable interface here for delegating this special type processing out to
		// each type-specific code for this.
		if (req.getType().equals("sn:rssfeed")) {
			node.setProp("sn:rssFeedSrc", "");
		}

		// same thing here. temporary hack for type handline
		if (req.getType().equals("bash")) {
			node.setProp("sn:name", "");
			node.setProp("sn:fileName", "");
		}

		api.save(session, node);

		res.setSuccess(true);
	}

	/*
	 * Saves the node with new information based on whatever is specified in the
	 * request.
	 */
	public void saveNode(MongoSession session, SaveNodeRequest req, SaveNodeResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		String nodeId = req.getNodeId();

		log.debug("saveNode. nodeId=" + nodeId + " nodeName=" + req.getName());
		SubNode node = api.getNode(session, nodeId);
		api.authRequireOwnerOfNode(session, node);

		if (node == null) {
			throw new RuntimeException("Unable find node to save: nodeId=" + nodeId);
		}
		node.setContent(req.getContent());
		if (req.getName() != null) {
			node.setName(req.getName());
		}

		if (req.getProperties() != null) {
			for (PropertyInfo property : req.getProperties()) {

				/*
				 * save only if server determines the property is savable. Just protection.
				 * Client shouldn't be trying to save stuff that is illegal to save, but we have
				 * to assume the worst behavior from client code, for security and robustness.
				 */
				if (SubNodeUtil.isSavableProperty(property.getName())) {
					log.debug("Property to save: " + property.getName() + "=" + property.getValue());
					if (property.getValue().equalsIgnoreCase("[delete-node-indicator]")) {
						node.deleteProp(property.getName());
					} else {
						node.setProp(property.getName(), property.getValue());
					}
				} else {
					/**
					 * TODO: This case indicates that data was sent unnecessarily. fix! (i.e. make
					 * sure this block cannot ever be entered)
					 */
					// log.debug("Ignoring unneeded save attempt on unneeded
					// prop: " + property.getName());
				}
			}

			Calendar lastModified = Calendar.getInstance();
			node.setModifyTime(lastModified.getTime());

			outboxMgr.sendNotificationForChildNodeCreate(node, sessionContext.getUserName());

			NodeInfo nodeInfo = convert.convertToNodeInfo(sessionContext, session, node, true, true, false, -1, false,
					false, false);
			res.setNode(nodeInfo);
			api.saveSession(session);
		}

		res.setSuccess(true);
	}

	/*
	 * Removes the property specified in the request from the node specified in the
	 * request
	 */
	public void deleteProperty(MongoSession session, DeletePropertyRequest req, DeletePropertyResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		String nodeId = req.getNodeId();
		SubNode node = api.getNode(session, nodeId);
		String propertyName = req.getPropName();
		node.deleteProp(propertyName);
		api.save(session, node);
		res.setSuccess(true);
	}

	/*
	 * When user pastes in a large amount of text and wants to have this text broken
	 * out into individual nodes they can pass into here and double spaces become
	 * splitpoints, and this splitNode method will break it all up into individual
	 * nodes.
	 */
	public void splitNode(MongoSession session, SplitNodeRequest req, SplitNodeResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		String nodeId = req.getNodeId();

		log.debug("Splitting node: " + nodeId);
		SubNode node = api.getNode(session, nodeId);
		SubNode parentNode = api.getParent(session, node);

		api.authRequireOwnerOfNode(session, node);

		String content = node.getContent();
		boolean containsSplitTag1 = content.contains(SPLIT_TAG1);
		boolean containsSplitTag2 = content.contains(SPLIT_TAG2);

		/*
		 * If split will have no effect, just return as if successful.
		 */
		if (!containsSplitTag1 && !containsSplitTag2) {
			res.setSuccess(true);
			return;
		}

		String[] contentParts = null;
		if (containsSplitTag1) {
			contentParts = StringUtils.splitByWholeSeparator(content, SPLIT_TAG1);
		} else if (containsSplitTag2) {
			contentParts = StringUtils.splitByWholeSeparator(content, SPLIT_TAG2);
		}

		SubNode parentForNewNodes = null;
		long firstOrdinal = 0;

		// When inserting inline all nodes go in right where the original node is, in
		// order below it as siblings
		if (req.getSplitType().equalsIgnoreCase("inline")) {
			parentForNewNodes = parentNode;
			firstOrdinal = node.getOrdinal();
		}
		// but for a 'child' insert all new nodes are inserted as children of the
		// original node, starting at
		// the top (ordinal), regardless of whether this node already has any children
		// or not.
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
	}
}
