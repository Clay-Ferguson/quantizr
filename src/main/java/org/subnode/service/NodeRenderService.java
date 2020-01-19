package org.subnode.service;

import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;

import javax.servlet.http.HttpSession;

import org.subnode.config.AppProp;
import org.subnode.config.NodeProp;
import org.subnode.config.SessionContext;
import org.subnode.model.NodeInfo;
import org.subnode.model.UserPreferences;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.mongo.model.types.AllSubNodeTypes;
import org.subnode.request.AnonPageLoadRequest;
import org.subnode.request.InitNodeEditRequest;
import org.subnode.request.RenderNodeRequest;
import org.subnode.response.AnonPageLoadResponse;
import org.subnode.response.InitNodeEditResponse;
import org.subnode.response.RenderNodeResponse;
import org.subnode.util.Convert;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.ThreadLocals;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

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
	private AllSubNodeTypes TYPES;

	@Autowired
	private FileSyncService fileSyncService;

	@Autowired
	private IPFSSyncService ipfsSyncService;

	/* Note: this MUST match nav.ROWS_PER_PAGE variable in TypeScript */
	private static int ROWS_PER_PAGE = 25;

	/*
	 * This is the call that gets all the data to show on a page. Whenever user is
	 * browsing to a new page, this method gets called once per page and retrieves
	 * all the data for that page.
	 */
	public void renderNode(MongoSession session, RenderNodeRequest req, RenderNodeResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		res.setOffsetOfNodeFound(-1);
		
		String targetId = req.getNodeId();

		log.debug("renderNode targetId:" + targetId);
		SubNode node = api.getNode(session, targetId);
		
		if (node == null) {
			res.setNoDataResponse("Node not found.");
			return;
		}

		log.debug("gotNode: " + node.getPath());

		UserPreferences userPreferences = sessionContext.getUserPreferences();
		boolean advancedMode = userPreferences != null ? userPreferences.isAdvancedMode() : false;
		// boolean showMetaData = userPreferences != null ?
		// userPreferences.isShowMetaData() : false;

		/*
		 * If this is true it means we need to keep scanning child nodes until we find
		 * the targetId, so we can make that one be the first of the search results to
		 * display, and set that offset upon return. During the scan once the node is
		 * found, we set this scanToNode var back to false, so it represents always if
		 * we're still scanning or not.
		 */
		boolean scanToNode = false;
		String scanToPath = node.getPath();

		if (req.isRenderParentIfLeaf() && !subNodeUtil.hasDisplayableNodes(advancedMode, node)) {
			res.setDisplayedParent(true);
			req.setUpLevel(1);
		}

		// the 'siblingOffset' is for jumping forward or backward thru at the same level
		// of the tree without
		// having to first 'uplevel' and then click on the prev or next node.
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
					try {
						SubNode parent = api.getParent(session, node);
						if (parent != null) {
							node = parent;
						} else {
							break;
						}
						log.trace("   upLevel to nodeid: " + node.getPath());
						levelsUpRemaining--;
					}
					// if we fail to get the node above, that is ok we just render the best one we
					// were able to get to. This can happen when user is rendering their User node
					// and
					// adding an attachment, before any children are ever created.
					catch (Exception e) {
						// scanToNode = false;
						break;
					}
				}
			}
		}

		// For IPFS Proof-of-Concept work we just code the call right here, rather than
		// having a plugin-based polymorphic
		// interface we can call to fully decouple the IPFS from this rener service.
		if (session.isAdmin()) {
			if (node.isType(TYPES.FS_FOLDER)) {
				fileSyncService.syncFolder(session, node, false, null);
			} else if (node.isType(TYPES.IPFS_NODE)) {
				ipfsSyncService.syncNode(session, node, false, null, req.isForceIPFSRefresh());
			}
		}

		NodeInfo nodeInfo = processRenderNode(session, req, res, node, scanToNode, scanToPath, 0, 0);
		res.setNode(nodeInfo);
	}

	private NodeInfo processRenderNode(MongoSession session, RenderNodeRequest req, RenderNodeResponse res,
			final SubNode node, boolean scanToNode, String scanToPath, int ordinal, int level) {

		// log.debug(
		// "RENDER: " + node.getPath() /* XString.prettyPrint(node) */ + " ordinal=" +
		// ordinal + "level=" + level);
		NodeInfo nodeInfo = convert.convertToNodeInfo(sessionContext, session, node, true, true, false, ordinal,
				level > 0, false, false);

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

		/*
		 * we request ROWS_PER_PAGE+1, because that is enough to trigger 'endReached'
		 * logic to be set correctly
		 */
		Iterable<SubNode> nodeIter = api.getChildren(session, node, true, queryLimit);
		Iterator<SubNode> iterator = nodeIter.iterator();

		int idx = 0, count = 0, idxOfNodeFound = -1;
		boolean endReached = false;

		if (req.isGoToLastPage()) {
			// todo-1: fix
			throw new RuntimeException("No ability to go to last page yet in new mongo api.");
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
				endReached = true;
				break;
			}
			SubNode n = iterator.next();

			idx++;
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

		res.setEndReached(endReached);
		return nodeInfo;
	}

	public void initNodeEdit(MongoSession session, InitNodeEditRequest req, InitNodeEditResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		String nodeId = req.getNodeId();
		SubNode node = api.getNode(session, nodeId);

		if (node == null) {
			res.setMessage("Node not found.");
			res.setSuccess(false);
			return;
		}

		NodeInfo nodeInfo = convert.convertToNodeInfo(sessionContext, session, node, false, false, true, -1, false,
				false, false);
		res.setNodeInfo(nodeInfo);
		res.setSuccess(true);
	}

	/*
	 * There is a system defined way for admins to specify what node should be
	 * displayed in the browser when a non-logged in user (i.e. anonymouse user) is
	 * browsing the site, and this method retrieves that page data.
	 */
	public void anonPageLoad(MongoSession session, AnonPageLoadRequest req, AnonPageLoadResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		String id = null;

		HttpSession httpSession = ThreadLocals.getHttpSession();
		if (httpSession.getAttribute("uri") != null) {
			// todo-0: is this code path obsolete?
			id = (String) httpSession.getAttribute("uri");
			httpSession.removeAttribute("uri");
		} //
		else if (sessionContext.getUrlId() != null) {
			id = sessionContext.getUrlId();
			sessionContext.setUrlId(null);
			log.debug("anonPageRedirected it's id to load to: " + id);
		} //
		else {
			// todo-0: landing page in app props will now be need to be interpreted as
			// 'name' (soon) will still work for now since nodes ARE named
			// in the path itself from legacy code.
			id = appProp.getUserLandingPageNode();
		}

		if (!StringUtils.isEmpty(id)) {
			RenderNodeResponse renderNodeRes = new RenderNodeResponse();
			RenderNodeRequest renderNodeReq = new RenderNodeRequest();

			/*
			 * if user specified an ID= parameter on the url we display that immediately, or
			 * else we display the node that the admin has configured to be the default
			 * landing page node.
			 */

			log.debug("Render Node ID: " + id);
			renderNodeReq.setNodeId(id);

			renderNode(session, renderNodeReq, renderNodeRes);
			res.setRenderNodeResponse(renderNodeRes);
			res.setSuccess(true);
		}  //
		else {
			res.setContent("No content available.");
			res.setSuccess(true);
		}
	}
}
