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
import org.subnode.config.AppProp;
import org.subnode.config.NodeName;
import org.subnode.config.SessionContext;
import org.subnode.exception.NodeAuthFailedException;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.BreadcrumbInfo;
import org.subnode.model.CalendarItem;
import org.subnode.model.NodeInfo;
import org.subnode.model.NodeMetaInfo;
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
import org.subnode.util.ExUtil;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;

/**
 * Service for rendering the content of a page. The actual page is not rendered on the server side.
 * What we are really doing here is generating a list of POJOS that get converted to JSON and sent
 * to the client. But regardless of format this is the primary service for pulling content up for
 * rendering the pages on the client as the user browses around on the tree.
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

	/* Note: this MUST match nav.ROWS_PER_PAGE variable in TypeScript */
	private static int ROWS_PER_PAGE = 25;

	private static RenderNodeResponse welcomePage;

	/*
	 * This is the call that gets all the data to show on a page. Whenever user is browsing to a new
	 * page, this method gets called once per page and retrieves all the data for that page.
	 */
	public RenderNodeResponse renderNode(MongoSession session, RenderNodeRequest req) {

		boolean isWelcomePage = req.getNodeId().equals(":welcome-page");

		/*
		 * Return cached version of welcome page if generated, but not for admin because admin should be
		 * able to make edits and then those edits update the cache
		 */
		if (isWelcomePage && welcomePage != null && !session.isAdmin()) {
			return welcomePage;
		}

		RenderNodeResponse res = new RenderNodeResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		String targetId = req.getNodeId();
		boolean isActualUplevelRequest = req.isUpLevel();

		// log.debug("renderNode: \nreq=" + XString.prettyPrint(req));
		SubNode node = null;
		try {
			node = read.getNode(session, targetId);
		} catch (NodeAuthFailedException e) {
			res.setSuccess(false);
			res.setMessage("Unauthorized.");
			res.setExceptionType("auth");
			log.error("error", e);
			return res;
		}

		if (node == null) {
			log.debug("nodeId not found: " + targetId + " sending user to :public instead");

			try {
				node = read.getNode(session, appProp.getUserLandingPageNode());

				if (node == null) {
					node = read.getNode(session, "/" + NodeName.ROOT);
				}
			} catch (Exception e) {
				node = read.getNode(session, "/" + NodeName.ROOT);
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
			NodeInfo nodeInfo =
					convert.convertToNodeInfo(ThreadLocals.getSessionContext(), session, node, true, false, -1, false, false);
			res.setNode(nodeInfo);
			res.setSuccess(true);
			return res;
		}

		/*
		 * If scanToNode is non-null it means we are trying to get a subset of the children that contains
		 * scanToNode as one child, because that's the child we want to highlight and scroll to on the front
		 * end when the query returns, and the page root node will of course be the parent of scanToNode
		 */
		SubNode scanToNode = null;

		if (req.isRenderParentIfLeaf() && !read.hasChildren(session, node)) {
			req.setUpLevel(true);
		}

		/*
		 * the 'siblingOffset' is for jumping forward or backward thru at the same level of the tree without
		 * having to first 'uplevel' and then click on the prev or next node.
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
			if (req.isUpLevel()) {
				try {
					SubNode parent = read.getParent(session, node);
					if (parent != null) {
						scanToNode = node;
						node = parent;
					}
				} catch (Exception e) {
					// failing to get parent is only an "auth" problem if this was an ACTUAL uplevel request, and not
					// something
					// we decided to to inside this method based on trying not to render a page with no children
					// showing.
					if (isActualUplevelRequest) {
						res.setExceptionType("auth");
						res.setSuccess(true);
						return res;
					}
				}
			}
		}

		if ("welcome-page".equals(node.getName())) {
			isWelcomePage = true;
		}

		int limit = ROWS_PER_PAGE;
		if (node != null) {
			// add pageSize hack to docs and admin part of user guide.
			Long pageSize = node.getIntProp("pageSize");
			if (pageSize != null && pageSize.intValue() > ROWS_PER_PAGE) {
				limit = pageSize.intValue();
			}
		}

		NodeInfo nodeInfo = processRenderNode(session, req, res, node, scanToNode, -1, 0, limit);
		res.setNode(nodeInfo);
		res.setSuccess(true);

		if (isWelcomePage) {
			NodeRenderService.welcomePage = res;
		}

		return res;
	}

	private NodeInfo processRenderNode(MongoSession session, RenderNodeRequest req, RenderNodeResponse res, final SubNode node,
			SubNode scanToNode, long logicalOrdinal, int level, int limit) {

		NodeInfo nodeInfo = convert.convertToNodeInfo(ThreadLocals.getSessionContext(), session, node, true, false,
				logicalOrdinal, level > 0, false);

		if (level > 0) {
			return nodeInfo;
		}

		nodeInfo.setChildren(new LinkedList<NodeInfo>());

		/*
		 * todo-1: a great optimization would be to allow caller to pass in an 'offset hint', based on
		 * information it already knows about the last offset where scanToNode was found to jump over likely
		 * unneeded records when searching for the scanToNode node.
		 *
		 * If we are scanning to a node we know we need to start from zero offset, or else we use the offset
		 * passed in. Offset is the number of nodes to IGNORE before we start collecting nodes.
		 */
		int offset = scanToNode != null ? 0 : req.getOffset();
		if (offset < 0) {
			offset = 0;
		}

		/*
		 * todo-1: needed optimization to work well with large numbers of child nodes: If scanToNode is in
		 * use, we should instead look up the node itself, and then get it's ordinal, and use that as a '>='
		 * in the query to pull up the list, at least when the node ordering is ordinal. Note, if sort order
		 * is by a timestamp we'd need a ">=" on the timestamp itself instead. We request ROWS_PER_PAGE+1,
		 * because that is enough to trigger 'endReached' logic to be set correctly
		 */
		int queryLimit = scanToNode != null ? 1000 : offset + limit + 2;

		// log.debug("query: offset=" + offset + " limit=" + queryLimit + " scanToNode="
		// + scanToNode);

		String orderBy = node.getStrProp(NodeProp.ORDER_BY.s());
		Sort sort = null;

		if (!StringUtils.isEmpty(orderBy)) {
			sort = parseOrderByToSort(orderBy);
		} else {
			sort = Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL);
		}

		Iterable<SubNode> nodeIter = read.getChildren(session, node, sort, queryLimit, offset);
		Iterator<SubNode> iterator = nodeIter.iterator();
		int idx = offset;

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

		// if (offset > 0) {
		// // log.debug("Skipping the first " + offset + " records in the resultset.");
		// idx = read.skip(iterator, offset);
		// }

		List<SubNode> slidingWindow = null;
		NodeInfo ninfo = null;

		/*
		 * Main loop to keep reading nodes from the database until we have enough to render the page
		 */
		while (true) {
			if (!iterator.hasNext()) {
				// log.debug("End reached.");
				endReached = true;
				break;
			}
			SubNode n = iterator.next();
			idx++;
			// log.debug("Iterate [" + idx + "]: nodeId" + n.getId().toHexString() + "
			// scanToNode=" + scanToNode);

			/* are we still just scanning for our target node */
			if (scanToNode != null) {
				/*
				 * If this is the node we are scanning for turn off scan mode, and add up to ROWS_PER_PAGE-1 of any
				 * sliding window nodes above it.
				 */
				if (n.getPath().equals(scanToNode.getPath())) {
					scanToNode = null;

					if (slidingWindow != null) {
						int count = slidingWindow.size();
						if (count > 0) {
							int relativeIdx = idx - 1;
							for (int i = count - 1; i >= 0; i--) {
								SubNode sn = slidingWindow.get(i);
								relativeIdx--;
								ninfo = processRenderNode(session, req, res, sn, null, relativeIdx, level + 1, limit);
								nodeInfo.getChildren().add(0, ninfo);

								/*
								 * If we have enough records we're done. Note having ">= ROWS_PER_PAGE/2" for example would also
								 * work and would bring back the target node as close to the center of the results sent back to
								 * the brower as possible, but what we do instead is just set to ROWS_PER_PAGE which maximizes
								 * performance by iterating the smallese number of results in order to get a page that contains
								 * what we need (namely the target node as indiated by scanToNode item)
								 */
								if (nodeInfo.getChildren().size() >= limit - 1) {
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
				 * else, we can continue while loop after we incremented 'idx'. Nothing else to do on this
				 * iteration/node
				 */
				else {
					/* lazily create sliding window */
					if (slidingWindow == null) {
						slidingWindow = new LinkedList<SubNode>();
					}

					/* update sliding window */
					slidingWindow.add(n);
					if (slidingWindow.size() > limit) {
						slidingWindow.remove(0);
					}

					continue;
				}
			}

			/* if we get here we're accumulating rows */
			ninfo = processRenderNode(session, req, res, n, null, idx - 1L, level + 1, limit);
			nodeInfo.getChildren().add(ninfo);

			if (nodeInfo.getChildren().size() >= limit) {
				if (!iterator.hasNext()) {
					endReached = true;
				}
				/* break out of while loop, we have enough children to send back */
				// log.debug("Full page is ready. Exiting loop.");
				break;
			}
		}

		/*
		 * if we accumulated less than ROWS_PER_PAGE, then try to scan back up the sliding window to build
		 * up the ROW_PER_PAGE by looking at nodes that we encountered before we reached the end.
		 */
		if (slidingWindow != null && nodeInfo.getChildren().size() < limit) {
			int count = slidingWindow.size();
			if (count > 0) {
				int relativeIdx = idx - 1;
				for (int i = count - 1; i >= 0; i--) {
					SubNode sn = slidingWindow.get(i);
					relativeIdx--;

					ninfo = processRenderNode(session, req, res, sn, null, (long) relativeIdx, level + 1, limit);
					nodeInfo.getChildren().add(0, ninfo);

					// If we have enough records we're done
					if (nodeInfo.getChildren().size() >= limit) {
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
	 * parses something like "priority asc" into a Sort object, assuming the field is in the property
	 * array of the node, rather than the name of an actual SubNode object member property.
	 */
	private Sort parseOrderByToSort(String orderBy) {
		Sort sort = null;
		int spaceIdx = orderBy.indexOf(" ");
		String dir = "asc"; // asc or desc
		if (spaceIdx != -1) {
			dir = orderBy.substring(spaceIdx + 1);
			orderBy = orderBy.substring(0, spaceIdx);
		}

		sort = Sort.by(dir.equals("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, SubNode.FIELD_PROPERTIES + "." + orderBy);

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

		try {
			SubNode parentNode = read.getParent(session, node);
			NodeInfo parentInfo = convert.convertToNodeInfo(ThreadLocals.getSessionContext(), session, parentNode, false, true,
					-1, false, false);
			res.setParentInfo(parentInfo);
		} catch (Exception e) {
			ExUtil.error(log, "unable to load parent", e);
			// ignore this
		}

		NodeInfo nodeInfo =
				convert.convertToNodeInfo(ThreadLocals.getSessionContext(), session, node, false, true, -1, false, false);
		res.setNodeInfo(nodeInfo);
		res.setSuccess(true);
		return res;
	}

	/*
	 * There is a system defined way for admins to specify what node should be displayed in the browser
	 * when a non-logged in user (i.e. anonymouse user) is browsing the site, and this method retrieves
	 * that page data.
	 */
	public RenderNodeResponse anonPageLoad(MongoSession session, RenderNodeRequest req) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		String id = null;
		SessionContext sc = ThreadLocals.getSessionContext();
		if (sc.getUrlId() != null) {
			id = sc.getUrlId();
			sc.setUrlId(null);
			log.debug("anonPageRedirected it's id to load to: " + id);
		} //
		else {
			id = appProp.getUserLandingPageNode();
		}

		log.debug("Anon Render Node ID: " + id);
		req.setNodeId(id);

		RenderNodeResponse res = renderNode(session, req);
		return res;
	}

	/*
	 * Reads all subnodes under name 'nodeName' (currently assumed to be an admin-owned node and shared
	 * to public), and populates them into model, recursively building a tree structure as flat property
	 * names in 'model' where each property is the 'content' of the node, and the key is the 'name' of
	 * the node
	 * 
	 * Returns true if there was a node at 'nodeName' and false otherwise.
	 */
	public boolean thymeleafRenderNode(HashMap<String, String> model, String nodeName) {
		MongoSession session = auth.getAdminSession();
		boolean ret = false;

		SubNode node = read.getNodeByName(session, nodeName, true);
		if (node != null) {
			final Iterable<SubNode> iter = read.getNamedNodes(session, node);
			final List<SubNode> children = read.iterateToList(iter);

			if (children != null) {
				for (final SubNode child : children) {
					if (!StringUtils.isEmpty(child.getName())) {
						model.put(child.getName(), child.getContent());
					}
				}
			}
			ret = true;
		} else {
			log.debug("unable to find node named: " + nodeName);
		}
		return ret;
	}

	public void populateSocialCardProps(SubNode node, Model model) {
		if (node == null)
			return;
		NodeMetaInfo metaInfo = subNodeUtil.getNodeMetaInfo(node);
		model.addAttribute("ogTitle", metaInfo.getTitle());
		model.addAttribute("ogDescription", metaInfo.getDescription());
		model.addAttribute("ogImage", metaInfo.getLink());
		model.addAttribute("ogUrl", metaInfo.getUrl());
	}

	public RenderCalendarResponse renderCalendar(MongoSession session, RenderCalendarRequest req) {
		RenderCalendarResponse res = new RenderCalendarResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		SubNode node = read.getNode(session, req.getNodeId());
		if (node == null) {
			return res;
		}

		LinkedList<CalendarItem> items = new LinkedList<CalendarItem>();
		res.setItems(items);

		for (SubNode n : read.getCalendar(session, node)) {
			CalendarItem item = new CalendarItem();

			String durationStr = n.getStrProp(NodeProp.DURATION.s());
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
			 * this is normal for users to wind up here because looking up the tree always ends at a place they
			 * can't access, and whatever paths we accumulated until this access error is what we do want to
			 * return so we just return everything as is by ignoring this exception
			 */
		}
	}
}
