package org.subnode.service;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoCreate;
import org.subnode.mongo.MongoDelete;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.DeleteNodesRequest;
import org.subnode.request.MoveNodesRequest;
import org.subnode.request.SelectAllNodesRequest;
import org.subnode.request.SetNodePositionRequest;
import org.subnode.response.DeleteNodesResponse;
import org.subnode.response.MoveNodesResponse;
import org.subnode.response.SelectAllNodesResponse;
import org.subnode.response.SetNodePositionResponse;
import org.subnode.util.ThreadLocals;

/**
 * Service for controlling the positions (ordinals) of nodes relative to their
 * parents and/or moving nodes to locate them under a different parent. This is
 * similar type of functionality to cut-and-paste in file systems. Currently
 * there is no way to 'clone' or copy nodes, but user can move any existing
 * nodes they have to any new location they want, subject to security
 * constraints of course.
 */
@Component
public class NodeMoveService {
	private static final Logger log = LoggerFactory.getLogger(NodeMoveService.class);

	@Autowired
	private MongoCreate create;

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoUpdate update;

	@Autowired
	private MongoDelete delete;

	@Autowired
	private MongoAuth auth;

	@Autowired
	private UserManagerService userManagerService;

	/*
	 * Moves the the node to a new ordinal/position location (relative to parent)
	 *
	 * We allow the special case of req.siblingId="[topNode]" and that indicates
	 * move the node to be the first node under its parent.
	 */
	public SetNodePositionResponse setNodePosition(MongoSession session, SetNodePositionRequest req) {
		SetNodePositionResponse res = new SetNodePositionResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		String nodeId = req.getNodeId();

		SubNode node = read.getNode(session, nodeId);
		if (node == null) {
			throw new RuntimeEx("Node not found: " + nodeId);
		}

		if ("up".equals(req.getTargetName())) {
			moveNodeUp(session, node);
		} else if ("down".equals(req.getTargetName())) {
			moveNodeDown(session, node);
		} else if ("top".equals(req.getTargetName())) {
			moveNodeToTop(session, node);
		} else if ("bottom".equals(req.getTargetName())) {
			moveNodeToBottom(session, node);
		} else {
			throw new RuntimeEx("Invalid target type: " + req.getTargetName());
		}

		res.setSuccess(true);
		return res;
	}

	public void moveNodeUp(MongoSession session, SubNode node) {
		SubNode nodeAbove = read.getSiblingAbove(session, node);
		if (nodeAbove != null) {
			Long saveOrdinal = nodeAbove.getOrdinal();
			nodeAbove.setOrdinal(node.getOrdinal());
			node.setOrdinal(saveOrdinal);
		}
		update.saveSession(session);
	}

	public void moveNodeDown(MongoSession session, SubNode node) {
		SubNode nodeBelow = read.getSiblingBelow(session, node);
		if (nodeBelow != null) {
			Long saveOrdinal = nodeBelow.getOrdinal();
			nodeBelow.setOrdinal(node.getOrdinal());
			node.setOrdinal(saveOrdinal);
		}
		update.saveSession(session);
	}

	public void moveNodeToTop(MongoSession session, SubNode node) {
		SubNode parentNode = read.getParent(session, node);
		if (parentNode == null) {
			return;
		}
		create.insertOrdinal(session, parentNode, 0L, 1L);

		// todo-2: there is a slight ineffieiency here in that 'node' does end up
		// getting saved
		// both as part of the insertOrdinal, and also then with the setting of it to
		// zero. Will be
		// easy to fix when I get to it, but is low priority for now.
		update.saveSession(session);

		node.setOrdinal(0L);
		update.saveSession(session);
	}

	public void moveNodeToBottom(MongoSession session, SubNode node) {
		SubNode parentNode = read.getParent(session, node);
		if (parentNode == null) {
			return;
		}
		long ordinal = read.getMaxChildOrdinal(session, parentNode) + 1L;
		node.setOrdinal(ordinal);
		parentNode.setMaxChildOrdinal(ordinal);
		update.saveSession(session);
	}

	/*
	 * Deletes the set of nodes specified in the request
	 */
	public DeleteNodesResponse deleteNodes(MongoSession session, DeleteNodesRequest req) {
		DeleteNodesResponse res = new DeleteNodesResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		SubNode userNode = read.getUserNodeByUserName(null, null);
		if (userNode == null) {
			throw new RuntimeEx("User not found.");
		}

		for (String nodeId : req.getNodeIds()) {
			// lookup the node we're going to delete
			SubNode node = read.getNode(session, nodeId);

			// back out the number of bytes it was using
			if (!session.isAdmin()) {
				userManagerService.addNodeBytesToUserNodeBytes(node, userNode, -1);
			}

			delete.deleteNode(session, node, req.isChildrenOnly());
		}

		update.saveSession(session);
		res.setSuccess(true);
		return res;
	}

	/*
	 * Moves a set of nodes to a new location, underneath (i.e. children of) the
	 * target node specified.
	 */
	public MoveNodesResponse moveNodes(MongoSession session, MoveNodesRequest req) {
		MoveNodesResponse res = new MoveNodesResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		moveNodesInternal(session, req.getLocation(), req.getTargetNodeId(), req.getNodeIds());
		res.setSuccess(true);
		return res;
	}

	/*
	 * If req.location==inside then the targetId is the parent node we will be
	 * inserting children into, but if req.location==inline the targetId represents
	 * the child who will become a sibling of what we are inserting, and the
	 * inserted nodes will be pasted in directly below that ordinal (i.e. new
	 * siblings posted in below it)
	 */
	private void moveNodesInternal(MongoSession session, String location, String targetId, List<String> nodeIds) {

		log.debug("moveNodesInternal: targetId=" + targetId + " location=" + location);
		SubNode targetNode = read.getNode(session, targetId);

		SubNode parentToPasteInto = location.equalsIgnoreCase("inside") ? targetNode
				: read.getParent(session, targetNode);

		auth.authRequireOwnerOfNode(session, parentToPasteInto);
		String parentPath = parentToPasteInto.getPath();
		// log.debug("targetPath: " + targetPath);
		Long curTargetOrdinal = null;

		// location==inside
		if (location.equalsIgnoreCase("inside")) {
			curTargetOrdinal = targetNode.getMaxChildOrdinal() == null ? 0 : targetNode.getMaxChildOrdinal() + 1;
		}
		// location==inline (todo-1: rename this to inline-below)
		else if (location.equalsIgnoreCase("inline")) {
			curTargetOrdinal = targetNode.getOrdinal() + 1;
			create.insertOrdinal(session, parentToPasteInto, curTargetOrdinal, nodeIds.size());
		}
		// location==inline-above
		else if (location.equalsIgnoreCase("inline-above")) {
			curTargetOrdinal = targetNode.getOrdinal();
			create.insertOrdinal(session, parentToPasteInto, curTargetOrdinal, nodeIds.size());
		}

		for (String nodeId : nodeIds) {
			// log.debug("Moving ID: " + nodeId);

			SubNode node = read.getNode(session, nodeId);
			auth.authRequireOwnerOfNode(session, node);
			SubNode nodeParent = read.getParent(session, node);

			/*
			 * If this 'node' will be changing parents (moving to new parent) we need to
			 * update its subgraph, of all children and also update its own path, otherwise
			 * it's staying under same parent and only it's ordinal will change.
			 */
			if (nodeParent.getId().compareTo(parentToPasteInto.getId()) != 0) {
				changePathOfSubGraph(session, node, parentPath);
				node.setPath(parentPath + "/" + node.getLastPathPart());
			}

			node.setOrdinal(curTargetOrdinal);
			node.setDisableParentCheck(true);

			curTargetOrdinal++;
		}
		update.saveSession(session);
	}

	private void changePathOfSubGraph(MongoSession session, SubNode graphRoot, String newPathPrefix) {
		String originalPath = graphRoot.getPath();
		log.debug("originalPath (graphRoot.path): " + originalPath);
		int originalParentPathLen = graphRoot.getParentPath().length();

		for (SubNode node : read.getSubGraph(session, graphRoot)) {
			if (!node.getPath().startsWith(originalPath)) {
				throw new RuntimeEx(
						"Algorighm failure: path " + node.getPath() + " should have started with " + originalPath);
			}
			log.debug("PROCESSING MOVE: oldPath: " + node.getPath());

			String newPath = newPathPrefix + "/" + node.getPath().substring(originalParentPathLen + 1);
			log.debug("    newPath: " + newPath);
			node.setPath(newPath);
			node.setDisableParentCheck(true);
		}
	}

	public SelectAllNodesResponse selectAllNodes(MongoSession session, SelectAllNodesRequest req) {
		SelectAllNodesResponse res = new SelectAllNodesResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		String nodeId = req.getParentNodeId();
		SubNode node = read.getNode(session, nodeId);
		List<String> nodeIds = read.getChildrenIds(session, node, false, null);
		res.setNodeIds(nodeIds);
		res.setSuccess(true);
		return res;
	}
}
