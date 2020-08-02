package org.subnode.service;

import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;

import org.subnode.AppController;
import org.subnode.config.AppProp;
import org.subnode.config.ConstantsProvider;
import org.subnode.config.SessionContext;
import org.subnode.exception.NodeAuthFailedException;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.NodeInfo;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.InitNodeEditRequest;
import org.subnode.request.RenderNodeRequest;
import org.subnode.response.InitNodeEditResponse;
import org.subnode.response.RenderNodeResponse;
import org.subnode.util.Const;
import org.subnode.util.Convert;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.springframework.ui.Model;

/**
 * Service for rendering the content of a page. The actual page is not rendered
 * on the server side. What we are really doing here is generating a list of
 * POJOS that get converted to JSON and sent to the client. But regardless of
 * format this is the primary service for pulling content up for rendering the
 * pages on the client as the user browses around on the tree.
 */
@Component
public class NodeRenderService {
	private static final Logger log = LoggerFactory.getLogger(NodeRenderService.class);

	@Autowired
	private SubNodeUtil subNodeUtil;

	@Autowired
	private MongoApi api;

	@Autowired
	private AppProp appProp;

	@Autowired
	private Convert convert;

	@Autowired
	private SessionContext sessionContext;

	@Autowired
	private FileSyncService fileSyncService;

	@Autowired
	private IPFSSyncService ipfsSyncService;

	@Autowired
	private ConstantsProvider constProvider;

	/* Note: this MUST match nav.ROWS_PER_PAGE variable in TypeScript */
	private static int ROWS_PER_PAGE = 25; //todo-0: do more testing with this at 5

	/*
	 * This is the call that gets all the data to show on a page. Whenever user is
	 * browsing to a new page, this method gets called once per page and retrieves
	 * all the data for that page.
	 */
	public RenderNodeResponse renderNode(MongoSession session, RenderNodeRequest req) {
		RenderNodeResponse res = new RenderNodeResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		res.setOffsetOfNodeFound(-1);

		String targetId = req.getNodeId();

		//log.debug("$$$$$$$$$$$$$$$$$$$$$$$$ renderNode: \nreq=" + XString.prettyPrint(req));
		SubNode node = null;
		try {
			node = api.getNode(session, targetId);
		} catch (NodeAuthFailedException e) {
			res.setSuccess(false);
			res.setMessage("Unauthorized.");
			res.setExceptionType("auth");
			log.error("error", e);
			// throw e;
			return res;
		}

		if (node == null) {
			res.setNoDataResponse("Node not found.");
			return res;
		}

		/* If only the single node was requested return that */
		if (req.isSingleNode()) {
			NodeInfo nodeInfo = convert.convertToNodeInfo(sessionContext, session, node, true, false, 0, false, false,
					false);
			res.setNode(nodeInfo);
			res.setSuccess(true);
			return res;
		}

		/*
		 * If this is true it means we need to keep scanning child nodes until we find
		 * the targetId, so we can make that one be the first of the search results to
		 * display, and set that offset upon return. During the scan once the node is
		 * found, we set this scanToNode var back to false, so it represents always if
		 * we're still scanning or not.
		 */
		boolean scanToNode = false;
		String scanToPath = node.getPath();

		if (req.isRenderParentIfLeaf() && !subNodeUtil.hasDisplayableNodes(session, false /* advanced_Mode */, node)) {
			res.setDisplayedParent(true);
			req.setUpLevel(1);
		}

		/*
		 * the 'siblingOffset' is for jumping forward or backward thru at the same level
		 * of the tree without having to first 'uplevel' and then click on the prev or
		 * next node.
		 */
		if (req.getSiblingOffset() != 0) {
			SubNode parent = api.getParent(session, node);
			if (req.getSiblingOffset() < 0) {
				SubNode nodeAbove = api.getSiblingAbove(session, node);
				if (nodeAbove != null) {
					node = nodeAbove;
				} else {
					node = parent != null ? parent : node;
				}
			} else if (req.getSiblingOffset() > 0) {
				SubNode nodeBelow = api.getSiblingBelow(session, node);
				if (nodeBelow != null) {
					node = nodeBelow;
				} else {
					node = parent != null ? parent : node;
				}
			} else {
				node = parent != null ? parent : node;
			}
		} else {
			int levelsUpRemaining = req.getUpLevel();
			if (levelsUpRemaining > 0) {
				scanToNode = true;

				while (node != null && levelsUpRemaining > 0) {
					// log.debug("upLevelsRemaining=" + levelsUpRemaining);
					try {
						SubNode parent = api.getParent(session, node);
						if (parent != null) {
							node = parent;
						} else {
							break;
						}
						// log.trace(" upLevel to nodeid: " + node.getPath());
						levelsUpRemaining--;
					} 
					catch (NodeAuthFailedException e) {
						throw e;
					}
					catch (Exception e) {
						/*
						 * UPDATE: It's never actually a render problem if we can't grab the parent in
						 * cases where we tried to. Always just allow it to render 'node' itself.
						 */
						scanToNode = false;
						break;
					}
				}
			}
		}

		/*
		 * For IPFS Proof-of-Concept work we just code the call right here, rather than
		 * having a plugin-based polymorphic interface we can call to fully decouple the
		 * IPFS from this rener service.
		 */
		if (session.isAdmin()) {
			if (node.isType(NodeType.FS_FOLDER)) {
				fileSyncService.syncFolder(session, node, false, null);
			} else if (node.isType(NodeType.IPFS_NODE)) {
				ipfsSyncService.syncNode(session, node, false, null, req.isForceIPFSRefresh());
			}
		}

		NodeInfo nodeInfo = processRenderNode(session, req, res, node, scanToNode, scanToPath, 0, 0);
		res.setNode(nodeInfo);
		res.setSuccess(true);
		return res;
	}

	/*
	 * todo-0: This entire thing needs to be checked over. All pagination aspects,
	 * offset, limit, scanToNode, is all due for full resting
	 */
	private NodeInfo processRenderNode(MongoSession session, RenderNodeRequest req, RenderNodeResponse res,
			final SubNode node, boolean scanToNode, String scanToPath, int ordinal, int level) {

		//log.debug("RENDER nodeId: " + node.getId().toHexString()); // .prettyPrint(node));
		NodeInfo nodeInfo = convert.convertToNodeInfo(sessionContext, session, node, true, false, ordinal, level > 0,
				false, false);

		if (level > 0) {
			return nodeInfo;
		}

		/*
		 * If we are scanning to a node we know we need to start from zero offset, or
		 * else we use the offset passed in
		 */
		int offset = scanToNode ? 0 : req.getOffset();

		/*
		 * load a LARGE number (todo-2: what should this large number be, 1000?) if we
		 * are scanning for a specific node and we don't know what it's actual offset
		 * is. Unfortunately this would mean broken pagination at large offsets. todo:
		 * need to check how to do basically an SQL "offset" index here but in MongoDB.
		 */
		int queryLimit = scanToNode ? 1000 : offset + ROWS_PER_PAGE + 1;

		//log.debug("query: offset=" + offset + " limit=" + queryLimit + " scanToNode=" + scanToNode);

		/*
		 * we request ROWS_PER_PAGE+1, because that is enough to trigger 'endReached'
		 * logic to be set correctly
		 */
		String orderBy = node.getStringProp("orderBy");
		Sort sort = null;
		if ("priority asc".equalsIgnoreCase(orderBy)) {
			sort = Sort.by(Sort.Direction.ASC, SubNode.FIELD_PROPERTIES + ".priority")
					.and(Sort.by(Sort.Direction.DESC, SubNode.FIELD_MODIFY_TIME));
		} else {
			sort = Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL);
		}
		Iterable<SubNode> nodeIter = api.getChildren(session, node, sort, queryLimit);
		Iterator<SubNode> iterator = nodeIter.iterator();

		int idx = 0, count = 0, idxOfNodeFound = -1;

		// this should only get set to true if we run out of records, because we reached
		// the true end of records and not related to a queryLimit
		boolean endReached = false;

		if (req.isGoToLastPage()) {
			// todo-1: fix
			throw new RuntimeEx("No ability to go to last page yet in new mongo api.");
			// offset = (int) nodeIter.getSize() - ROWS_PER_PAGE;
			// if (offset < 0) {
			// offset = 0;
			// }
			// res.setOffsetOfNodeFound(offset);
		}

		/*
		 * Calling 'skip' here technically violates the fact that
		 * nodeVisibleInSimpleMode() can return false for some nodes, but because of the
		 * performance boost it offers i'm doing it anyway. I don't think skipping to
		 * far or too little by one or two will ever be a noticeable issue in the
		 * paginating so this should be fine, because there will be a very small number
		 * of nodes that are not visible to the user, so I can't think of a pathological
		 * case here. Just noting that this IS an imperfection/flaw.
		 * 
		 * todo-1: Instead of running 'skip' here we should be setting an 'offset' on
		 * the initial query.
		 */
		if (!scanToNode && offset > 0) {
			//log.debug("Skipping the first " + offset + " records in the resultset.");
			idx = api.skip(iterator, offset);
		}

		List<SubNode> slidingWindow = null;

		/*
		 * If we are scanning for a specific node, and starting at zero offset, then we
		 * need to be capturing all the nodes as we go, in a sliding window, so that in
		 * case we find this node on the first page then we can use the slidingWindow
		 * nodes to build the entire first page, because we will need to send back these
		 * nodes starting from the first one.
		 */
		if (offset == 0 && scanToNode) {
			slidingWindow = new LinkedList<SubNode>();
		}

		NodeInfo ninfo = null;

		/*
		 * Main loop to keep reading nodes from the database until we have enough to
		 * render the page
		 */
		while (true) {
			if (!iterator.hasNext()) {
				//log.debug("End reached.");
				endReached = true;
				break;
			}
			SubNode n = iterator.next();
			idx++;
			//log.debug("NodeFound[" + idx + "]: nodeId" + n.getId().toHexString());
			if (idx > offset) {

				if (scanToNode) {
					String testPath = n.getPath();

					/*
					 * If this is the node we are scanning for turn off scan mode, but record its
					 * index position
					 */
					if (testPath.equals(scanToPath)) {
						scanToNode = false;

						/*
						 * If we found our target node, and it's on the first page, then we don't need
						 * to set idxOfNodeFound, but just leave it unset, and we need to load in the
						 * nodes we had collected so far, before continuing
						 */
						if (idx <= ROWS_PER_PAGE && slidingWindow != null) {

							/* loop over all our precached nodes */
							for (SubNode sn : slidingWindow) {
								count++;

								if (nodeInfo.getChildren() == null) {
									nodeInfo.setChildren(new LinkedList<NodeInfo>());
								}

								// log.debug("renderNode DUMP[count=" + count + " idx=" +
								// String.valueOf(idx) + " logicalOrdinal=" + String.valueOf(offset
								// + count) + "]: "
								// + XString.prettyPrint(node));
								ninfo = processRenderNode(session, req, res, sn, false, null, offset + count,
										level + 1);
								nodeInfo.getChildren().add(ninfo);
								if (offset == 0 && nodeInfo.getChildren().size() == 1) {
									ninfo.setFirstChild(true);
								}
							}
						} else {
							idxOfNodeFound = idx;
						}
					}
					/*
					 * else, we can continue while loop after we incremented 'idx'. Nothing else to
					 * do on this iteration/node
					 */
					else {
						/* Are we still within the bounds of the first page ? */
						if (idx <= ROWS_PER_PAGE && slidingWindow != null) {
							slidingWindow.add(n);
						}

						continue;
					}
				}

				count++;

				if (nodeInfo.getChildren() == null) {
					nodeInfo.setChildren(new LinkedList<NodeInfo>());
				}
				// log.debug("renderNode DUMP[count=" + count + " idx=" + String.valueOf(idx) +
				// "
				// logicalOrdinal=" + String.valueOf(offset + count) + "]: "
				// + XString.prettyPrint(node));
				ninfo = processRenderNode(session, req, res, n, false, null, offset + count, level + 1);
				nodeInfo.getChildren().add(ninfo);

				if (offset == 0 && nodeInfo.getChildren().size() == 1) {
					ninfo.setFirstChild(true);
				}

				if (count >= ROWS_PER_PAGE) {
					if (!iterator.hasNext()) {
						endReached = true;
					}
					/* break out of while loop, we have enough children to send back */
					//log.debug("Full page is ready. Exiting loop.");
					break;
				}
			}
		}

		if (idx == 0) {
			log.trace("no child nodes found.");
		}

		if (idxOfNodeFound != -1) {
			res.setOffsetOfNodeFound(idxOfNodeFound);
		}

		if (endReached && ninfo != null && nodeInfo.getChildren().size() > 1) {
			ninfo.setLastChild(true);
		}

		//log.debug("Setting endReached="+endReached);
		res.setEndReached(endReached);
		return nodeInfo;
	}

	public InitNodeEditResponse initNodeEdit(MongoSession session, InitNodeEditRequest req) {
		InitNodeEditResponse res = new InitNodeEditResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		String nodeId = req.getNodeId();
		SubNode node = api.getNode(session, nodeId);

		if (node == null) {
			res.setMessage("Node not found.");
			res.setSuccess(false);
			return res;
		}

		NodeInfo nodeInfo = convert.convertToNodeInfo(sessionContext, session, node, false, true, -1, false, false,
				false);
		res.setNodeInfo(nodeInfo);
		res.setSuccess(true);
		return res;
	}

	/*
	 * There is a system defined way for admins to specify what node should be
	 * displayed in the browser when a non-logged in user (i.e. anonymouse user) is
	 * browsing the site, and this method retrieves that page data.
	 */
	public RenderNodeResponse anonPageLoad(MongoSession session, RenderNodeRequest req) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		String id = null;
		if (sessionContext.getUrlId() != null) {
			id = sessionContext.getUrlId();
			sessionContext.setUrlId(null);
			log.debug("anonPageRedirected it's id to load to: " + id);
		} //
		else {
			id = appProp.getUserLandingPageNode();
		}

		log.debug("Anon Render Node ID: " + id);
		req.setNodeId(id);

		return renderNode(session, req);
	}

	/*
	 * Reads all subnodes under name 'nodeName' (currently assumed to be an
	 * admin-owned node and shared to public), and populates them into model,
	 * recursively building a tree structure as flat property names in 'model' where
	 * each property is the 'content' of the node.
	 * 
	 * Returns true if there was a node at 'nodeName' and false otherwise.
	 */
	public boolean thymeleafRenderNode(HashMap<String, String> model, String nodeName) {
		MongoSession session = api.getAdminSession();
		boolean ret = false;

		SubNode node = api.getNodeByName(session, nodeName, true);
		if (node != null) {
			thymeleafProcessChildren(session, node, model, null);
			ret = true;
		} else {
			log.debug("unable to find node named: " + nodeName);
		}
		return ret;
	}

	/*
	 * Node name starts out as root name like 'welcome', but as the recursion
	 * proceeds, it gets appended like, 'welcome.intro', 'welcome.intro.para1' etc.
	 * whenever the recursion encounters a named node. So the 'dotted properties'
	 * represent the hiearchy of the node structure.
	 */
	public void thymeleafProcessChildren(MongoSession session, SubNode node, HashMap<String, String> model,
			String parentName) {
		String nodeName;

		/*
		 * If this node has a name, create a model map entry based on the name that
		 * contains the content of the node
		 */
		if (!StringUtils.isEmpty(node.getName())) {
			nodeName = parentName != null ? parentName + "__" + node.getName() : node.getName();
			log.debug("thymeleaf [" + nodeName + "]=" + node.getContent());
			model.put(nodeName, node.getContent());
		}
		// if this node it not named, skip but process all it's children
		else {
			nodeName = parentName;
		}

		List<SubNode> children = api.getChildrenAsList(session, node, true, null);
		if (children != null) {
			for (SubNode child : children) {
				thymeleafProcessChildren(session, child, model, nodeName);
			}
		}
	}

	public void populateSocialCardProps(SubNode node, Model model) {
		String ogTitle = "";
		String ogDescription = "";
		String ogImage = "";
		String ogUrl = "";

		if (node != null) {
			String content = node.getContent();
			int newLineIdx = content.indexOf("\n");
			if (newLineIdx != -1) {
				ogTitle = content.substring(0, newLineIdx).trim();

				// remove leading hash marks which will be there if this is a markdown heading.
				while (ogTitle.startsWith("#")) {
					ogTitle = XString.stripIfStartsWith(ogTitle, "#");
				}
				ogTitle = ogTitle.trim();
				ogDescription = content.substring(newLineIdx + 1).trim();
			} else {
				ogDescription = content;
			}

			ogImage = getImageUrl(node);
			ogUrl = constProvider.getHostAndPort() + "/app?id=" + node.getId().toHexString();
		}

		model.addAttribute("ogTitle", ogTitle);
		model.addAttribute("ogDescription", ogDescription);
		model.addAttribute("ogImage", ogImage);
		model.addAttribute("ogUrl", ogUrl);
	}

	public String getImageUrl(SubNode node) {
		String ipfsLink = node.getStringProp(NodeProp.IPFS_LINK);
		if (ipfsLink != null) {
			return Const.IPFS_GATEWAY + ipfsLink;
		}

		String bin = node.getStringProp(NodeProp.BIN);
		if (bin != null) {
			return constProvider.getHostAndPort() + AppController.API_PATH + "/bin/" + bin + "?nodeId="
					+ node.getId().toHexString();
		}
		return null;
	}
}
