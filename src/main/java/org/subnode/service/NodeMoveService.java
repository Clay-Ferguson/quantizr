package org.subnode.service;

import java.util.ArrayList;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.DeleteNodesRequest;
import org.subnode.request.JoinNodesRequest;
import org.subnode.request.MoveNodesRequest;
import org.subnode.request.SelectAllNodesRequest;
import org.subnode.request.SetNodePositionRequest;
import org.subnode.response.DeleteNodesResponse;
import org.subnode.response.JoinNodesResponse;
import org.subnode.response.MoveNodesResponse;
import org.subnode.response.SelectAllNodesResponse;
import org.subnode.response.SetNodePositionResponse;
import org.subnode.util.ThreadLocals;

/**
 * Service for controlling the positions (ordinals) of nodes relative to their parents and/or moving
 * nodes to locate them under a different parent. This is similar type of functionality to
 * cut-and-paste in file systems. Currently there is no way to 'clone' or copy nodes, but user can
 * move any existing nodes they have to any new location they want, subject to security constraints
 * of course.
 */
@Component
public class NodeMoveService extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(NodeMoveService.class);

	/*
	 * Moves the the node to a new ordinal/position location (relative to parent)
	 *
	 * We allow the special case of req.siblingId="[topNode]" and that indicates move the node to be the
	 * first node under its parent.
	 */
	public SetNodePositionResponse setNodePosition(MongoSession ms, SetNodePositionRequest req) {
		SetNodePositionResponse res = new SetNodePositionResponse();
		ms = ThreadLocals.ensure(ms);

		String nodeId = req.getNodeId();

		SubNode node = read.getNode(ms, nodeId);
		auth.ownerAuth(ms, node);
		if (node == null) {
			throw new RuntimeEx("Node not found: " + nodeId);
		}

		if ("up".equals(req.getTargetName())) {
			moveNodeUp(ms, node);
		} else if ("down".equals(req.getTargetName())) {
			moveNodeDown(ms, node);
		} else if ("top".equals(req.getTargetName())) {
			moveNodeToTop(ms, node);
		} else if ("bottom".equals(req.getTargetName())) {
			moveNodeToBottom(ms, node);
		} else {
			throw new RuntimeEx("Invalid target type: " + req.getTargetName());
		}

		res.setSuccess(true);
		return res;
	}

	public void moveNodeUp(MongoSession ms, SubNode node) {
		SubNode nodeAbove = read.getSiblingAbove(ms, node);
		if (nodeAbove != null) {
			Long saveOrdinal = nodeAbove.getOrdinal();
			nodeAbove.setOrdinal(node.getOrdinal());
			node.setOrdinal(saveOrdinal);
		}
		update.saveSession(ms);
	}

	public void moveNodeDown(MongoSession ms, SubNode node) {
		SubNode nodeBelow = read.getSiblingBelow(ms, node);
		if (nodeBelow != null) {
			Long saveOrdinal = nodeBelow.getOrdinal();
			nodeBelow.setOrdinal(node.getOrdinal());
			node.setOrdinal(saveOrdinal);
		}
		update.saveSession(ms);
	}

	public void moveNodeToTop(MongoSession ms, SubNode node) {
		SubNode parentNode = read.getParent(ms, node);
		if (parentNode == null) {
			return;
		}
		create.insertOrdinal(ms, parentNode, 0L, 1L);

		/*
		 * todo-2: there is a slight ineffieiency here in that 'node' does end up getting saved both as part
		 * of the insertOrdinal, and also then with the setting of it to zero. Will be easy to fix when I
		 * get to it, but is low priority for now.
		 */
		update.saveSession(ms);

		node.setOrdinal(0L);
		update.saveSession(ms);
	}

	public void moveNodeToBottom(MongoSession ms, SubNode node) {
		SubNode parentNode = read.getParent(ms, node);
		if (parentNode == null) {
			return;
		}
		long ordinal = read.getMaxChildOrdinal(ms, parentNode) + 1L;
		node.setOrdinal(ordinal);
		parentNode.setMaxChildOrdinal(ordinal);
		update.saveSession(ms);
	}

	/*
	 * Note: Browser can send nodes these in any order, in the request, and always the lowest ordinal is
	 * the one we keep and join to
	 */
	public JoinNodesResponse joinNodes(MongoSession ms, JoinNodesRequest req) {
		JoinNodesResponse res = new JoinNodesResponse();
		ms = ThreadLocals.ensure(ms);

		// add to list becasue we will sort
		ArrayList<SubNode> nodes = new ArrayList<SubNode>();

		String parentPath = null;
		for (String nodeId : req.getNodeIds()) {
			SubNode node = read.getNode(ms, nodeId);

			if (parentPath == null) {
				parentPath = node.getParentPath();
			} else if (!parentPath.equals(node.getParentPath())) {
				res.setMessage("Failed: All nodes must be under the same parent node.");
				res.setSuccess(false);
				return res;
			}

			auth.ownerAuth(ms, node);
			nodes.add(node);
		}

		nodes.sort((s1, s2) -> (int) (s1.getOrdinal() - s2.getOrdinal()));

		StringBuilder sb = new StringBuilder();
		SubNode firstNode = null;
		int counter = 0;

		for (SubNode n : nodes) {
			if (firstNode == null) {
				firstNode = n;
			}
			if (counter > 0) {
				sb.append("\n");
			}

			if (!StringUtils.isEmpty(n.getContent())) {
				// trim and add ONE new line, for consistency.
				sb.append(n.getContent().trim());
				sb.append("\n");
			}

			if (counter > 0) {
				/* If node has an attachment we don't delete the node, but just set it's content to null */
				if (n.getStrProp(NodeProp.BIN) != null || n.getStrProp(NodeProp.IPFS_LINK) != null) {
					n.setContent(null);
					n.touch();
					update.save(ms, n);
				}
				/* or else we delete the node */
				else {
					delete.deleteNode(ms, n, false);
				}
			}
			counter++;
		}

		firstNode.setContent(sb.toString());
		firstNode.touch();
		update.saveSession(ms);
		res.setSuccess(true);
		return res;
	}

	/*
	 * Deletes the set of nodes specified in the request
	 */
	public DeleteNodesResponse deleteNodes(MongoSession ms, DeleteNodesRequest req) {
		DeleteNodesResponse res = new DeleteNodesResponse();
		ms = ThreadLocals.ensure(ms);

		SubNode userNode = read.getUserNodeByUserName(null, null);
		if (userNode == null) {
			throw new RuntimeEx("User not found.");
		}

		for (String nodeId : req.getNodeIds()) {
			// lookup the node we're going to delete
			SubNode node = read.getNode(ms, nodeId);
			auth.ownerAuthByThread(node);

			// back out the number of bytes it was using
			if (!ms.isAdmin()) {
				/*
				 * NOTE: There is no equivalent to this on the IPFS code path for deleting ipfs becuase since we
				 * don't do reference counting we let the garbage collecion cleanup be the only way user quotas are
				 * deducted from
				 */
				user.addNodeBytesToUserNodeBytes(ms, node, userNode, -1);
			}

			try {
				delete.deleteNode(ms, node, req.isChildrenOnly());
			} catch (Exception e) {
				// ignore failed deletes.
			}
		}

		update.saveSession(ms);
		res.setSuccess(true);
		return res;
	}

	/*
	 * Moves a set of nodes to a new location, underneath (i.e. children of) the target node specified.
	 */
	public MoveNodesResponse moveNodes(MongoSession ms, MoveNodesRequest req) {
		MoveNodesResponse res = new MoveNodesResponse();
		ms = ThreadLocals.ensure(ms);

		moveNodesInternal(ms, req.getLocation(), req.getTargetNodeId(), req.getNodeIds());
		res.setSuccess(true);
		return res;
	}

	/*
	 * If req.location==inside then the targetId is the parent node we will be inserting children into,
	 * but if req.location==inline the targetId represents the child who will become a sibling of what
	 * we are inserting, and the inserted nodes will be pasted in directly below that ordinal (i.e. new
	 * siblings posted in below it)
	 */
	private void moveNodesInternal(MongoSession ms, String location, String targetId, List<String> nodeIds) {
		log.debug("moveNodesInternal: targetId=" + targetId + " location=" + location);
		SubNode targetNode = read.getNode(ms, targetId);

		SubNode parentToPasteInto = location.equalsIgnoreCase("inside") ? targetNode : read.getParent(ms, targetNode);

		auth.ownerAuth(ms, parentToPasteInto);
		String parentPath = parentToPasteInto.getPath();
		// log.debug("targetPath: " + targetPath);
		Long curTargetOrdinal = null;

		// location==inside
		if (location.equalsIgnoreCase("inside")) {
			curTargetOrdinal = targetNode.getMaxChildOrdinal() == null ? 0 : targetNode.getMaxChildOrdinal() + 1;
		}
		// location==inline (todo-2: rename this to inline-below -- or better yet, do an
		// enum)
		else if (location.equalsIgnoreCase("inline")) {
			curTargetOrdinal = targetNode.getOrdinal() + 1;
			create.insertOrdinal(ms, parentToPasteInto, curTargetOrdinal, nodeIds.size());
		}
		// location==inline-above
		else if (location.equalsIgnoreCase("inline-above")) {
			curTargetOrdinal = targetNode.getOrdinal();
			create.insertOrdinal(ms, parentToPasteInto, curTargetOrdinal, nodeIds.size());
		}

		for (String nodeId : nodeIds) {
			// log.debug("Moving ID: " + nodeId);

			SubNode node = read.getNode(ms, nodeId);
			auth.ownerAuth(ms, node);
			SubNode nodeParent = read.getParent(ms, node);

			Long _targetOrdinal = curTargetOrdinal;
			arun.run(as -> {
				/*
				 * If this 'node' will be changing parents (moving to new parent) we need to update its subgraph, of
				 * all children and also update its own path, otherwise it's staying under same parent and only it's
				 * ordinal will change.
				 */
				if (nodeParent.getId().compareTo(parentToPasteInto.getId()) != 0) {

					// if a parent node is attempting to be pasted into one of it's children that's an impossible move so we fail
					if (parentToPasteInto.getPath().startsWith(node.getPath())) {
						throw new RuntimeException("Impossible node move requested.");
					}
					changePathOfSubGraph(as, node, parentPath);
					node.setPath(parentPath + "/" + node.getLastPathPart());
				}

				node.setOrdinal(_targetOrdinal);
				node.setDisableParentCheck(true);
				return null;
			});
			curTargetOrdinal++;
		}

		arun.run(as -> {
			update.saveSession(as);
			return null;
		});
	}

	private void changePathOfSubGraph(MongoSession ms, SubNode graphRoot, String newPathPrefix) {
		String originalPath = graphRoot.getPath();
		log.debug("originalPath (graphRoot.path): " + originalPath);
		int originalParentPathLen = graphRoot.getParentPath().length();

		for (SubNode node : read.getSubGraph(ms, graphRoot, null, 0)) {
			if (!node.getPath().startsWith(originalPath)) {
				throw new RuntimeEx("Algorighm failure: path " + node.getPath() + " should have started with " + originalPath);
			}
			log.debug("PROCESSING MOVE: oldPath: " + node.getPath());

			String pathSuffix = node.getPath().substring(originalParentPathLen + 1);
			String newPath = newPathPrefix + "/" + pathSuffix;
			// log.debug("    newPath: [" + newPathPrefix + "]/[" + pathSuffix + "]");
			node.setPath(newPath);
			node.setDisableParentCheck(true);
		}
	}

	public SelectAllNodesResponse selectAllNodes(MongoSession ms, SelectAllNodesRequest req) {
		SelectAllNodesResponse res = new SelectAllNodesResponse();
		ms = ThreadLocals.ensure(ms);

		String nodeId = req.getParentNodeId();
		SubNode node = read.getNode(ms, nodeId);
		List<String> nodeIds = read.getChildrenIds(ms, node, false, null);
		res.setNodeIds(nodeIds);
		res.setSuccess(true);
		return res;
	}
}
