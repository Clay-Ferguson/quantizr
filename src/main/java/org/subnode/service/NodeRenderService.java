package org.subnode.service;

import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.springframework.ui.Model;
import org.subnode.AppController;
import org.subnode.config.AppProp;
import org.subnode.config.ConstantsProvider;
import org.subnode.config.NodeName;
import org.subnode.config.SessionContext;
import org.subnode.exception.NodeAuthFailedException;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.BreadcrumbInfo;
import org.subnode.model.CalendarItem;
import org.subnode.model.NodeInfo;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.InitNodeEditRequest;
import org.subnode.request.RenderCalendarRequest;
import org.subnode.request.RenderNodeRequest;
import org.subnode.response.InitNodeEditResponse;
import org.subnode.response.RenderCalendarResponse;
import org.subnode.response.RenderNodeResponse;
import org.subnode.util.Convert;
import org.subnode.util.DateUtil;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;

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
	private MongoRead read;

	@Autowired
	private AppProp appProp;

	@Autowired
	private Convert convert;

	@Autowired
	private MongoAuth auth;

	@Autowired
	private SessionContext sessionContext;

	@Autowired
	private ConstantsProvider constProvider;

	/* Note: this MUST match nav.ROWS_PER_PAGE variable in TypeScript */
	private static int ROWS_PER_PAGE = 25;

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

		String targetId = req.getNodeId();

		// log.debug("renderNode: \nreq=" + XString.prettyPrint(req));
		SubNode node = null;
		try {
			node = read.getNode(session, targetId);
		} catch (NodeAuthFailedException e) {
			res.setSuccess(false);
			res.setMessage("Unauthorized.");
			res.setExceptionType("auth");
			log.error("error", e);
			// throw e;
			return res;
		}

		if (node == null) {
			log.debug("nodeId not found: " + targetId + " sending user to :public instead");
			node = read.getNode(session, appProp.getUserLandingPageNode());

			if (node == null) {
				node = read.getNode(session, "/" + NodeName.ROOT + "/" + NodeName.PUBLIC + "/home");
			}
		}

		if (node == null) {
			res.setNoDataResponse("Node not found.");
			return res;
		}

		LinkedList<BreadcrumbInfo> breadcrumbs = new LinkedList<BreadcrumbInfo>();
		res.setBreadcrumbs(breadcrumbs);
		getBreadcrumbs(session, node, breadcrumbs);

		/* If only the single node was requested return that */
		if (req.isSingleNode()) {
			NodeInfo nodeInfo = convert.convertToNodeInfo(sessionContext, session, node, true, false, -1, false, false);
			res.setNode(nodeInfo);
			res.setSuccess(true);
			return res;
		}

		/*
		 * If this is true it means we need to keep scanning child nodes until we find
		 * the targetId, so we can make that one be the first of the search results to
		 * display, and set that offset upon return. During the scan once the node is
		 * found, we set this scanToNode var back to false.
		 */
		boolean scanToNode = false;
		String scanToPath = node.getPath();

		if (req.isRenderParentIfLeaf() && !subNodeUtil.hasDisplayableNodes(session, node)) {
			req.setUpLevel(1);
		}

		/*
		 * the 'siblingOffset' is for jumping forward or backward thru at the same level
		 * of the tree without having to first 'uplevel' and then click on the prev or
		 * next node.
		 */
		if (req.getSiblingOffset() != 0) {
			SubNode parent = read.getParent(session, node);
			if (req.getSiblingOffset() < 0) {
				SubNode nodeAbove = read.getSiblingAbove(session, node);
				if (nodeAbove != null) {
					node = nodeAbove;
				} else {
					node = parent != null ? parent : node;
				}
			} else if (req.getSiblingOffset() > 0) {
				SubNode nodeBelow = read.getSiblingBelow(session, node);
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
						SubNode parent = read.getParent(session, node);
						if (parent != null) {
							node = parent;
						} else {
							break;
						}
						// log.trace(" upLevel to nodeid: " + node.getPath());
						levelsUpRemaining--;
					} catch (Exception e) {
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

		NodeInfo nodeInfo = processRenderNode(session, req, res, node, scanToNode, scanToPath, -1, 0);
		res.setNode(nodeInfo);
		res.setSuccess(true);
		return res;
	}

	private NodeInfo processRenderNode(MongoSession session, RenderNodeRequest req, RenderNodeResponse res,
			final SubNode node, boolean scanToNode, String scanToPath, long logicalOrdinal, int level) {

		NodeInfo nodeInfo = convert.convertToNodeInfo(sessionContext, session, node, true, false, logicalOrdinal,
				level > 0, false);

		if (level > 0) {
			return nodeInfo;
		}

		nodeInfo.setChildren(new LinkedList<NodeInfo>());

		// todo-0: a great optimization would be to allow caller to pass in an 'offset hint', 
		// based on information it already knows to jump over likely unneeded records when searching
		// for a scanToNode node. 
		/*
		 * If we are scanning to a node we know we need to start from zero offset, or
		 * else we use the offset passed in. Offset is the number of nodes to IGNORE
		 * before we start collecting nodes.
		 */
		int offset = scanToNode ? 0 : req.getOffset();
		if (offset < 0) {
			offset = 0;
		}

		/*
		 * todo-1: needed optimization to work well with large numbers of child nodes:
		 * If scanToNode is in use, we should instead look up the node itself, and then
		 * get it's ordinal, and use that as a '>=' in the query to pull up the list, at
		 * least when the node ordering is ordinal. Note, if sort order is by a
		 * timestamp we'd need a ">=" on the timestamp itself instead. We request
		 * ROWS_PER_PAGE+1, because that is enough to trigger 'endReached' logic to be
		 * set correctly
		 */
		int queryLimit = scanToNode ? 1000 : offset + ROWS_PER_PAGE + 2;

		//log.debug("query: offset=" + offset + " limit=" + queryLimit + " scanToNode=" + scanToNode);

		String orderBy = node.getStringProp(NodeProp.ORDER_BY.s());
		Sort sort = null;

		if (!StringUtils.isEmpty(orderBy)) {
			sort = parseOrderByToSort(orderBy);
		} else {
			sort = Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL);
		}

		Iterable<SubNode> nodeIter = read.getChildren(session, node, sort, queryLimit);
		Iterator<SubNode> iterator = nodeIter.iterator();

		int idx = 0;

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
		}

		if (offset > 0) {
			// log.debug("Skipping the first " + offset + " records in the resultset.");
			idx = read.skip(iterator, offset);
		}

		List<SubNode> slidingWindow = null;
		NodeInfo ninfo = null;

		/*
		 * Main loop to keep reading nodes from the database until we have enough to
		 * render the page
		 */
		while (true) {
			if (!iterator.hasNext()) {
				// log.debug("End reached.");
				endReached = true;
				break;
			}
			SubNode n = iterator.next();
			idx++;
			//log.debug("Iterate [" + idx + "]: nodeId" + n.getId().toHexString() + " scanToNode=" + scanToNode);

			/* are we still just scanning for our target node */
			if (scanToNode) {
				/*
				 * If this is the node we are scanning for turn off scan mode, and add up to
				 * ROWS_PER_PAGE-1 of any sliding window nodes above it.
				 */
				if (n.getPath().equals(scanToPath)) {
					scanToNode = false;

					if (slidingWindow != null) {
						int count = slidingWindow.size();
						if (count > 0) {
							int relativeIdx = idx - 1;
							for (int i = count - 1; i >= 0; i--) {
								SubNode sn = slidingWindow.get(i);
								relativeIdx--;
								ninfo = processRenderNode(session, req, res, sn, false, null, relativeIdx, level + 1);
								nodeInfo.getChildren().add(0, ninfo);

								// If we have enough records we're done
								if (nodeInfo.getChildren().size() >= ROWS_PER_PAGE - 1) {
									break;
								}
							}
						}

						// We won't need sliding window again, we now just accumulate up to
						// ROWS_PER_PAGE max and we're done.
						slidingWindow = null;
					}
				}
				/*
				 * else, we can continue while loop after we incremented 'idx'. Nothing else to
				 * do on this iteration/node
				 */
				else {
					/* lazily create sliding window */
					if (slidingWindow == null) {
						slidingWindow = new LinkedList<SubNode>();
					}

					/* update sliding window */
					slidingWindow.add(n);
					if (slidingWindow.size() > ROWS_PER_PAGE) {
						slidingWindow.remove(0);
					}

					continue;
				}
			}

			/* if we get here we're accumulating rows */
			ninfo = processRenderNode(session, req, res, n, false, null, idx - 1L, level + 1);
			nodeInfo.getChildren().add(ninfo);

			if (nodeInfo.getChildren().size() >= ROWS_PER_PAGE) {
				if (!iterator.hasNext()) {
					endReached = true;
				}
				/* break out of while loop, we have enough children to send back */
				// log.debug("Full page is ready. Exiting loop.");
				break;
			}
		}

		/*
		 * if we accumulated less than ROWS_PER_PAGE, then try to scan back up the
		 * sliding window to build up the ROW_PER_PAGE by looking at nodes that we
		 * encountered before we reached the end.
		 */
		if (slidingWindow != null && nodeInfo.getChildren().size() < ROWS_PER_PAGE) {
			int count = slidingWindow.size();
			if (count > 0) {
				int relativeIdx = idx - 1;
				for (int i = count - 1; i >= 0; i--) {
					SubNode sn = slidingWindow.get(i);
					relativeIdx--;

					ninfo = processRenderNode(session, req, res, sn, false, null, (long) relativeIdx, level + 1);
					nodeInfo.getChildren().add(0, ninfo);

					// If we have enough records we're done
					if (nodeInfo.getChildren().size() >= ROWS_PER_PAGE) {
						break;
					}
				}
			}
		}

		if (idx == 0) {
			log.trace("no child nodes found.");
		}

		if (endReached && ninfo != null && nodeInfo.getChildren().size() > 1) {
			ninfo.setLastChild(true);
		}

		// log.debug("Setting endReached="+endReached);
		res.setEndReached(endReached);
		return nodeInfo;
	}

	/*
	 * parses something like "priority asc" into a Sort object, assuming the field
	 * is in the property array of the node, rather than the name of an actual
	 * SubNode object member property.
	 */
	private Sort parseOrderByToSort(String orderBy) {
		Sort sort = null;
		int spaceIdx = orderBy.indexOf(" ");
		String dir = "asc"; // asc or desc
		if (spaceIdx != -1) {
			dir = orderBy.substring(spaceIdx + 1);
			orderBy = orderBy.substring(0, spaceIdx);
		}

		sort = Sort.by(dir.equals("asc") ? Sort.Direction.ASC : Sort.Direction.DESC,
				SubNode.FIELD_PROPERTIES + "." + orderBy);

		if (orderBy.equals("priority")) {
			sort = sort.and(Sort.by(Sort.Direction.DESC, SubNode.FIELD_MODIFY_TIME));
		}

		return sort;
	}

	public InitNodeEditResponse initNodeEdit(MongoSession session, InitNodeEditRequest req) {
		InitNodeEditResponse res = new InitNodeEditResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		String nodeId = req.getNodeId();
		SubNode node = read.getNode(session, nodeId);

		if (node == null) {
			res.setMessage("Node not found.");
			res.setSuccess(false);
			return res;
		}

		NodeInfo nodeInfo = convert.convertToNodeInfo(sessionContext, session, node, false, true, -1, false, false);
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
	public boolean /* WARNING: this method name exists in docs */ thymeleafRenderNode(HashMap<String, String> model,
			String nodeName) {
		MongoSession session = auth.getAdminSession();
		boolean ret = false;

		SubNode node = read.getNodeByName(session, nodeName, true);
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
			// log.debug("thymeleaf [" + nodeName + "]=" + node.getContent());
			model.put(nodeName, node.getContent());
		}
		// if this node it not named, skip but process all it's children
		else {
			nodeName = parentName;
		}

		List<SubNode> children = read.getChildrenAsList(session, node, true, null);
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

			ogImage = getAttachmentUrl(node);
			ogUrl = constProvider.getHostAndPort() + "/app?id=" + node.getId().toHexString();
		}

		model.addAttribute("ogTitle", ogTitle);
		model.addAttribute("ogDescription", ogDescription);
		model.addAttribute("ogImage", ogImage);
		model.addAttribute("ogUrl", ogUrl);
	}

	public String getAttachmentUrl(SubNode node) {
		String ipfsLink = node.getStringProp(NodeProp.IPFS_LINK);

		/*
		 * If we had a public gateway we could actually trust we could return this, but
		 * gateways have a tendency to be flaky and often appear to blacklist videos
		 * uploated thru Quanta.wiki, and I won't even speculate why
		 */
		// if (ipfsLink != null) {
		// return Const.IPFS_IO_GATEWAY + ipfsLink;
		// }

		String bin = ipfsLink != null ? ipfsLink : node.getStringProp(NodeProp.BIN);
		if (bin != null) {
			return constProvider.getHostAndPort() + AppController.API_PATH + "/bin/" + bin + "?nodeId="
					+ node.getId().toHexString();
		}
		return null;
	}

	public RenderCalendarResponse renderCalendar(MongoSession session, RenderCalendarRequest req) {
		RenderCalendarResponse res = new RenderCalendarResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		LinkedList<CalendarItem> items = new LinkedList<CalendarItem>();
		res.setItems(items);

		SubNode node = read.getNode(session, req.getNodeId());
		if (node == null) {
			return res;
		}

		for (SubNode n : read.getCalendar(session, node)) {
			CalendarItem item = new CalendarItem();

			String durationStr = n.getStringProp(NodeProp.DURATION.s());
			long duration = DateUtil.getMillisFromDuration(durationStr);
			if (duration == 0) {
				duration = 60 * 60 * 1000;
			}

			String content = n.getContent();
			content = XString.truncateAfterFirst(content, "\n");
			content = XString.truncateAfterFirst(content, "\r");
			item.setTitle(content);
			item.setId(n.getId().toHexString());
			item.setStart(n.getIntProp(NodeProp.DATE.s()));
			item.setEnd(item.getStart() + duration);
			items.add(item);
		}

		return res;
	}

	public void getBreadcrumbs(MongoSession session, SubNode node, LinkedList<BreadcrumbInfo> list) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		try {
			if (node != null) {
				node = read.getParent(session, node);
			}

			while (node != null) {
				BreadcrumbInfo bci = new BreadcrumbInfo();
				if (list.size() >= 5) {
					// This toplevel one is shows up on the client as "..." indicating more parents
					// further up
					bci.setId("");
					list.add(0, bci);
					break;
				}

				String content = node.getContent();
				if (content == null) {
					content = "";
				} else if (content.startsWith("<[ENC]>")) {
					content = "[encrypted]";
				} else {
					content = content.trim();
					content = XString.truncateAfterFirst(content, "\n");
					content = XString.truncateAfterFirst(content, "\r");
					while (content.startsWith("#")) {
						content = content.substring(1);
					}

					if (content.length() > 25) {
						content = content.substring(0, 25) + "...";
					}
				}

				bci.setName(content);
				bci.setId(node.getId().toHexString());
				bci.setType(node.getType());
				list.add(0, bci);

				node = read.getParent(session, node);
			}
		} catch (Exception e) {
			/*
			 * this is normal for users to wind up here because looking up the tree always
			 * ends at a place they can't access, and whatever paths we accumulated until
			 * this access error is what we do want to return so we just return everything
			 * as is by ignoring this exception
			 */
		}
	}
}
