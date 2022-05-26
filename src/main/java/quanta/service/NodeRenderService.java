package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.springframework.ui.Model;
import quanta.config.ServiceBase;
import quanta.exception.NodeAuthFailedException;
import quanta.exception.base.RuntimeEx;
import quanta.instrument.PerfMon;
import quanta.model.BreadcrumbInfo;
import quanta.model.CalendarItem;
import quanta.model.NodeInfo;
import quanta.model.NodeMetaInfo;
import quanta.model.client.ConstantInt;
import quanta.model.client.ErrorType;
import quanta.model.client.NodeMetaIntf;
import quanta.model.client.NodeProp;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.GetNodeMetaInfoRequest;
import quanta.request.InitNodeEditRequest;
import quanta.request.RenderCalendarRequest;
import quanta.request.RenderNodeRequest;
import quanta.response.GetNodeMetaInfoResponse;
import quanta.response.InitNodeEditResponse;
import quanta.response.RenderCalendarResponse;
import quanta.response.RenderNodeResponse;
import quanta.util.DateUtil;
import quanta.util.ThreadLocals;
import quanta.util.XString;

/**
 * Service for rendering the content of a page. The actual page is not rendered on the server side.
 * What we are really doing here is generating a list of POJOS that get converted to JSON and sent
 * to the client. But regardless of format this is the primary service for pulling content up for
 * rendering the pages on the client as the user browses around on the tree.
 */
@Component
public class NodeRenderService extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(NodeRenderService.class);

	public GetNodeMetaInfoResponse getNodeMetaInfo(MongoSession ms, GetNodeMetaInfoRequest req) {
		GetNodeMetaInfoResponse res = new GetNodeMetaInfoResponse();
		List<NodeMetaIntf> list = new LinkedList<>();
		res.setNodeIntf(list);

		for (String id : req.getIds()) {
			boolean hasChildren = read.hasChildren(ms, new ObjectId(id));
			list.add(new NodeMetaIntf(id, hasChildren));
		}
		res.setSuccess(true);
		return res;
	}

	/*
	 * This is the call that gets all the data to show on a page. Whenever user is browsing to a new
	 * page, this method gets called once per page and retrieves all the data for that page.
	 */
	@PerfMon(category = "render")
	public RenderNodeResponse renderNode(MongoSession ms, RenderNodeRequest req) {
		RenderNodeResponse res = new RenderNodeResponse();
		ms = ThreadLocals.ensure(ms);
		String targetId = req.getNodeId();
		boolean isActualUplevelRequest = req.isUpLevel();

		// log.debug("renderNode: \nreq=" + XString.prettyPrint(req));
		SubNode node = null;
		try {
			node = read.getNode(ms, targetId);
		} catch (NodeAuthFailedException e) {
			res.setSuccess(false);
			res.setMessage("Unauthorized.");
			res.setErrorType(ErrorType.AUTH.s());
			log.error("error", e);
			return res;
		}

		if (no(node)) {
			log.debug("nodeId not found: " + targetId + " sending user to :public instead");
			node = read.getNode(ms, prop.getUserLandingPageNode());
		}

		if (no(node)) {
			res.setNoDataResponse("Node not found.");
			return res;
		}

		// NOTE: This code was for loading MFS defined content live as it's rendered, but for now we don't do this, and only have a kind of import/export to/from
		// a node and MFS as a menu option that must be explicitly run.
		// if (ok(node.getStr(NodeProp.IPFS_SCID))) {
		// 	SyncFromMFSService svc = (SyncFromMFSService) context.getBean(SyncFromMFSService.class);
		// 	svc.loadNode(ms, node);
		// }

		/* If only the single node was requested return that */
		if (req.isSingleNode()) {
			// that loads these all asynchronously.
			NodeInfo nodeInfo =
					convert.convertToNodeInfo(ThreadLocals.getSC(), ms, node, true, false, -1, false, false, true, false, true, true);
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

		if (req.isForceRenderParent() || (req.isRenderParentIfLeaf() && !read.hasChildren(ms, node))) {
			req.setUpLevel(true);
		}

		/*
		 * the 'siblingOffset' is for jumping forward or backward thru at the same level of the tree without
		 * having to first 'uplevel' and then click on the prev or next node.
		 */
		if (req.getSiblingOffset() != 0) {
			SubNode parent = read.getParent(ms, node);
			if (req.getSiblingOffset() < 0) {
				SubNode nodeAbove = read.getSiblingAbove(ms, node);
				if (ok(nodeAbove)) {
					node = nodeAbove;
				} else {
					node = ok(parent) ? parent : node;
				}
			} else if (req.getSiblingOffset() > 0) {
				SubNode nodeBelow = read.getSiblingBelow(ms, node);
				if (ok(nodeBelow)) {
					node = nodeBelow;
				} else {
					node = ok(parent) ? parent : node;
				}
			} else {
				node = ok(parent) ? parent : node;
			}
		} else {
			if (req.isUpLevel()) {
				try {
					SubNode parent = read.getParent(ms, node);
					if (ok(parent)) {
						scanToNode = node;
						node = parent;
					}
				} catch (Exception e) {
					// failing to get parent is only an "auth" problem if this was an ACTUAL uplevel
					// request, and not
					// something
					// we decided to to inside this method based on trying not to render a page with
					// no children
					// showing.
					if (isActualUplevelRequest) {
						res.setErrorType(ErrorType.AUTH.s());
						res.setSuccess(true);
						return res;
					}
				}
			}
		}

		int limit = ConstantInt.ROWS_PER_PAGE.val();
		if (ok(node)) {
			// add pageSize hack to docs and admin part of user guide.
			Long pageSize = node.getInt("pageSize");
			if (ok(pageSize) && pageSize.intValue() > ConstantInt.ROWS_PER_PAGE.val()) {
				limit = pageSize.intValue();
			}
		}

		// Collect all the parents we need to based on parentCount
		LinkedList<NodeInfo> parentNodes = new LinkedList<>();
		SubNode highestUpParent = node;
		int parentCount = req.getParentCount();
		boolean done = false;
		while (!done && parentCount-- > 0) {
			try {
				highestUpParent = read.getParent(ms, highestUpParent);
				if (ok(highestUpParent)) {
					NodeInfo nodeInfo = convert.convertToNodeInfo(ThreadLocals.getSC(), ms, highestUpParent, true, false, 0,
							false, false, false, false, true, true);

					// each parent up goes on top of list for correct rendering order on client.
					parentNodes.addFirst(nodeInfo);
				}
			} catch (Exception e) {
				done = true;
				// if we run into any errors collecting children we can ignore them.
			}
		}

		LinkedList<BreadcrumbInfo> breadcrumbs = new LinkedList<>();
		res.setBreadcrumbs(breadcrumbs);
		render.getBreadcrumbs(ms, highestUpParent, breadcrumbs);

		NodeInfo nodeInfo = render.processRenderNode(ms, req, res, node, scanToNode, -1, 0, limit);
		nodeInfo.setParents(parentNodes);
		res.setNode(nodeInfo);
		res.setSuccess(true);

		// todo-2: this was a quick fix, and this urlId handling is also a slight bit awkward and maybe
		// needs to be reworked.
		ThreadLocals.getSC().setUrlId(null);

		// log.debug("renderNode Full Return: " + XString.prettyPrint(res));
		return res;
	}

	@PerfMon(category = "render")
	public NodeInfo processRenderNode(MongoSession ms, RenderNodeRequest req, RenderNodeResponse res, SubNode node,
			SubNode scanToNode, long logicalOrdinal, int level, int limit) {

		/*
		 * see also: tag #getNodeMetaInfo
		 * 
		 * Note: if you set the hasChildren to true here to update children flag on nodes immediately here,
		 * then you can also remove the getNodeMetaInfo() call where you see that on the client, and that's
		 * all you need to do, but for now we're using getNodeMetaInfo to query for all the children
		 * asynchronously from the page load, after the page renders, to make things perform better (i.e.
		 * faster diaplay of pages).
		 * 
		 * So this means the page first renders *without* knowing of any 'hasChildren' (resulting in no
		 * expand icons displayed), and then slightly after that the client calls getNodeMetaInfo() to
		 * retrieve that information asynchronously and then updates the page, showing all the expand icons
		 * on all the nodes that have children.
		 */
		NodeInfo nodeInfo = convert.convertToNodeInfo(ThreadLocals.getSC(), ms, node, true, false, logicalOrdinal, level > 0,
				false, false, false, true, true);

		if (level > 0) {
			return nodeInfo;
		}

		nodeInfo.setChildren(new LinkedList<>());

		/*
		 * If we are scanning to a node we know we need to start from zero offset, or else we use the offset
		 * passed in. Offset is the number of nodes to IGNORE before we start collecting nodes.
		 */
		int offset = ok(scanToNode) ? 0 : req.getOffset();
		if (offset < 0) {
			offset = 0;
		}

		/*
		 * todo-2: needed optimization to work well with large numbers of child nodes: If scanToNode is in
		 * use, we should instead look up the node itself, and then get it's ordinal, and use that as a '>='
		 * in the query to pull up the list when the node ordering is ordinal. Note, if sort order is by a
		 * timestamp we'd need a ">=" on the timestamp itself instead. We request ROWS_PER_PAGE+1, because
		 * that is enough to trigger 'endReached' logic to be set correctly
		 */
		int queryLimit = ok(scanToNode) ? -1 : offset + limit + 2;

		// log.debug("query: offset=" + offset + " limit=" + queryLimit + " scanToNode="
		// + scanToNode);

		String orderBy = node.getStr(NodeProp.ORDER_BY.s());
		Sort sort = null;

		if (!StringUtils.isEmpty(orderBy)) {
			sort = parseOrderBy(orderBy);
		}

		if (no(sort)) {
			// log.debug("processRenderNode querying by ordinal.");
			sort = Sort.by(Sort.Direction.ASC, SubNode.ORDINAL);
		}

		Iterable<SubNode> nodeIter = read.getChildren(ms, node, sort, queryLimit, offset);
		Iterator<SubNode> iterator = nodeIter.iterator();
		int idx = offset;

		// this should only get set to true if we run out of records, because we reached
		// the true end of records and not related to a queryLimit
		boolean endReached = false;

		if (req.isGoToLastPage()) {
			// todo-2: fix
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
			// log.debug("Iterate [" + idx + "]: nodeId" + n.getIdStr() + "scanToNode=" +
			// scanToNode);
			// log.debug(" DATA: " + XString.prettyPrint(n));

			/* are we still just scanning for our target node */
			if (ok(scanToNode)) {
				/*
				 * If this is the node we are scanning for turn off scan mode, and add up to ROWS_PER_PAGE-1 of any
				 * sliding window nodes above it.
				 */
				if (n.getPath().equals(scanToNode.getPath())) {
					scanToNode = null;

					if (ok(slidingWindow)) {
						int count = slidingWindow.size();
						if (count > 0) {
							int relativeIdx = idx - 1;
							for (int i = count - 1; i >= 0; i--) {
								SubNode sn = slidingWindow.get(i);
								relativeIdx--;
								ninfo = render.processRenderNode(ms, req, res, sn, null, relativeIdx, level + 1, limit);
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
					if (no(slidingWindow)) {
						slidingWindow = new LinkedList<>();
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
			ninfo = render.processRenderNode(ms, req, res, n, null, idx - 1L, level + 1, limit);
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
		if (ok(slidingWindow) && nodeInfo.getChildren().size() < limit) {
			int count = slidingWindow.size();
			if (count > 0) {
				int relativeIdx = idx - 1;
				for (int i = count - 1; i >= 0; i--) {
					SubNode sn = slidingWindow.get(i);
					relativeIdx--;

					ninfo = render.processRenderNode(ms, req, res, sn, null, (long) relativeIdx, level + 1, limit);
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

		if (endReached && ok(ninfo) && nodeInfo.getChildren().size() > 1) {
			ninfo.setLastChild(true);
		}

		// log.debug("Setting endReached="+endReached);
		res.setEndReached(endReached);
		return nodeInfo;
	}

	/*
	 * Nodes can have a propety like orderBy="priority asc", and that allow the children to be displayed
	 * in that order.
	 *
	 * parses something like "priority asc" into a Sort object, assuming the field is in the property
	 * array of the node, rather than the name of an actual SubNode object member property.
	 */
	private Sort parseOrderBy(String orderBy) {
		Sort sort = null;
		int spaceIdx = orderBy.indexOf(" ");
		String dir = "asc"; // asc or desc
		if (spaceIdx != -1) {
			String orderByProp = orderBy.substring(0, spaceIdx);
			dir = orderBy.substring(spaceIdx + 1);
			sort = Sort.by(dir.equals("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, SubNode.PROPS + "." + orderByProp);

			/*
			 * when sorting by priority always do second level REV-CHRON sort, so newest un-prioritized nodes
			 * appear at top. todo-2: probably would be better to to just make this orderBy parser handle
			 * comma-delimited sort list which is not a difficult change
			 */
			if (orderByProp.equals(NodeProp.PRIORITY.s())) {
				sort = sort.and(Sort.by(Sort.Direction.DESC, SubNode.MODIFY_TIME));
			}
		}
		return sort;
	}

	public InitNodeEditResponse initNodeEdit(MongoSession ms, InitNodeEditRequest req) {
		InitNodeEditResponse res = new InitNodeEditResponse();
		String nodeId = req.getNodeId();
		SubNode node = read.getNode(ms, nodeId);
		auth.ownerAuth(ms, node);

		if (no(node)) {
			res.setMessage("Node not found.");
			res.setSuccess(false);
			return res;
		}

		NodeInfo nodeInfo = convert.convertToNodeInfo(ThreadLocals.getSC(), ms, node, false, true, -1, false, false, true, false, false, false);
		res.setNodeInfo(nodeInfo);
		res.setSuccess(true);
		return res;
	}

	/*
	 * There is a system defined way for admins to specify what node should be displayed in the browser
	 * when a non-logged in user (i.e. anonymouse user) is browsing the site, and this method retrieves
	 * that page data.
	 */
	public RenderNodeResponse anonPageLoad(MongoSession ms, RenderNodeRequest req) {
		ms = ThreadLocals.ensure(ms);

		String id = prop.getUserLandingPageNode();
		// log.debug("Anon Render Node ID: " + id);

		if (ok(ThreadLocals.getSC().getUrlId())) {
			id = ThreadLocals.getSC().getUrlId();
			ThreadLocals.getSC().setUrlId(null);
		}

		// log.debug("anonPageLoad id=" + id);
		req.setNodeId(id);

		RenderNodeResponse res = renderNode(ms, req);
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
		MongoSession as = auth.getAdminSession();
		boolean ret = false;

		SubNode node = read.getNodeByName(as, nodeName, true);
		if (ok(node)) {
			Iterable<SubNode> iter = read.getNamedNodes(as, node);
			List<SubNode> children = read.iterateToList(iter);

			if (ok(children)) {
				for (SubNode child : children) {
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
		if (no(node))
			return;
			
		NodeMetaInfo metaInfo = snUtil.getNodeMetaInfo(node);
		model.addAttribute("ogTitle", metaInfo.getTitle());
		model.addAttribute("ogDescription", metaInfo.getDescription());

		String mime = metaInfo.getAttachmentMime();
		if (ok(mime) && mime.startsWith("image/")) {
			model.addAttribute("ogImage", metaInfo.getAttachmentUrl());
		}

		model.addAttribute("ogUrl", metaInfo.getUrl());
	}

	public RenderCalendarResponse renderCalendar(MongoSession ms, RenderCalendarRequest req) {
		RenderCalendarResponse res = new RenderCalendarResponse();

		SubNode node = read.getNode(ms, req.getNodeId());
		if (no(node)) {
			return res;
		}

		LinkedList<CalendarItem> items = new LinkedList<>();
		res.setItems(items);

		for (SubNode n : read.getCalendar(ms, node)) {
			CalendarItem item = new CalendarItem();

			String content = n.getContent();
			content = render.getFirstLineAbbreviation(content, 25);

			item.setTitle(content);
			item.setId(n.getIdStr());
			item.setStart(n.getInt(NodeProp.DATE));

			String durationStr = n.getStr(NodeProp.DURATION.s());
			long duration = DateUtil.getMillisFromDuration(durationStr);
			if (duration == 0) {
				duration = 60 * 60 * 1000;
			}

			item.setEnd(item.getStart() + duration);
			items.add(item);
		}

		return res;
	}

	@PerfMon(category = "render")
	public void getBreadcrumbs(MongoSession ms, SubNode node, LinkedList<BreadcrumbInfo> list) {
		ms = ThreadLocals.ensure(ms);

		try {
			if (ok(node)) {
				node = read.getParent(ms, node);
			}

			while (ok(node)) {
				BreadcrumbInfo bci = new BreadcrumbInfo();
				if (list.size() >= 5) {
					// This toplevel one is shows up on the client as "..." indicating more parents
					// further up
					bci.setId("");
					list.add(0, bci);
					break;
				}

				String content = node.getContent();

				if (StringUtils.isEmpty(content)) {
					if (!StringUtils.isEmpty(node.getName())) {
						content = node.getName();
					} else {
						content = "";
					}
				} else if (content.startsWith("<[ENC]>")) {
					content = "[encrypted]";
				} else {
					content = getFirstLineAbbreviation(content, 25);
				}

				bci.setName(content);
				bci.setId(node.getIdStr());
				bci.setType(node.getType());
				list.add(0, bci);

				node = read.getParent(ms, node);
			}
		} catch (Exception e) {
			/*
			 * this is normal for users to wind up here because looking up the tree always ends at a place they
			 * can't access, and whatever paths we accumulated until this access error is what we do want to
			 * return so we just return everything as is by ignoring this exception
			 */
		}
	}

	public String stripRenderTags(String content) {
		if (no(content))
			return null;
		content = content.replace("{{imgUpperRight}}", "");
		content = content.replace("{{imgUpperLeft}}", "");
		content = content.replace("{{imgUpperCenter}}", "");
		content = content.replace("{{img}}", "");
		content = content.trim();

		while (content.startsWith("#")) {
			content = XString.stripIfStartsWith(content, "#");
		}
		content = content.trim();
		return content;
	}

	public String getFirstLineAbbreviation(String content, int maxLen) {
		if (no(content))
			return null;

		content = stripRenderTags(content);
		content = XString.truncateAfterFirst(content, "\n");
		content = XString.truncateAfterFirst(content, "\r");
		while (content.startsWith("#")) {
			content = content.substring(1);
		}

		if (content.length() > maxLen) {
			content = content.substring(0, maxLen) + "...";
		}
		return content.trim();
	}
}
