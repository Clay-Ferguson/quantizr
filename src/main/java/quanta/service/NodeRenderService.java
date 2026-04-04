package quanta.service;

import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.BulkOperations.BulkMode;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;
import org.springframework.ui.Model;
import jakarta.servlet.http.HttpServletResponse;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.exception.ForbiddenException;
import quanta.exception.base.RuntimeEx;
import quanta.model.BreadcrumbInfo;
import quanta.model.CalendarItem;
import quanta.model.NodeInfo;
import quanta.model.NodeMetaInfo;
import quanta.model.client.ClientConfig;
import quanta.model.client.Constant;
import quanta.model.client.ConstantInt;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;
import quanta.rest.request.RenderCalendarRequest;
import quanta.rest.request.RenderNodeRequest;
import quanta.rest.response.RenderCalendarResponse;
import quanta.rest.response.RenderNodeResponse;
import quanta.util.Const;
import quanta.util.Convert;
import quanta.util.DateUtil;
import quanta.util.ExUtil;
import quanta.util.TL;
import quanta.util.XString;
import quanta.util.val.Val;

/**
 * Service for rendering the content of a page. The actual page is not rendered on the server side.
 * What we are really doing here is generating a list of POJOS that get converted to JSON and sent
 * to the client. But regardless of format this is the primary service for pulling content up for
 * rendering the pages on the client as the user browses around on the tree.
 */
@Component
public class NodeRenderService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(NodeRenderService.class);

    /**
     * Generates the index page for the given parameters.
     *
     * @param nameOnAdminNode The name of the admin node.
     * @param nameOnUserNode The name of the user node.
     * @param userName The name of the user.
     * @param id The ID of the node.
     * @param search The search query.
     * @param name The name of the node.
     * @param signupCode The signup code.
     * @param login The login status.
     * @param view The view parameter.
     * @param model The model to add attributes to.
     * @return The name of the view to render.
     */
    public String cm_getIndexPage(String nameOnAdminNode, String nameOnUserNode, String userName, String id,
            String search, String name, String signupCode, String login, String view, Model model) {
        HashMap<String, Object> attrs = getThymeleafAttribs();
        boolean isHomeNodeRequest = false;

        // Node Names are identified using a colon in front of it, to make it detectable
        if (!StringUtils.isEmpty(nameOnUserNode) && !StringUtils.isEmpty(userName)) {
            if (Const.HOME_NODE_NAME.equalsIgnoreCase(nameOnUserNode)) {
                isHomeNodeRequest = true;
            }
            id = ":" + userName + ":" + nameOnUserNode;
        } //
        else if (!StringUtils.isEmpty(nameOnAdminNode)) {
            id = ":" + nameOnAdminNode;
        } //
        else if (!StringUtils.isEmpty(name)) {
            id = ":" + name;
        }

        boolean hasUrlId = false;
        /*
         * if we have an ID, try to look it up, to put it in the session and load the Social Card properties
         * for this request. If no id given defalt to ":home" only so we can get the social card props.
         */
        if (id != null) {
            hasUrlId = true;
        } else {
            id = NodePath.PUBLIC_HOME;
        }

        String _id = id;
        boolean _hasUrlId = hasUrlId;
        boolean _isHomeNodeRequest = isHomeNodeRequest;
        ClientConfig config = new ClientConfig();

        SubNode node = null;
        try {
            Val<SubNode> accntNode = new Val<>();
            node = svc_mongoRead.getNode(_id, accntNode);
            if (node == null) {
                if (_isHomeNodeRequest && accntNode.hasVal()) {
                    config.setDisplayUserProfileId(accntNode.getVal().getIdStr());
                }
            }
        } catch (Exception e) {
            config.setUserMsg("Unable to access node: " + _id);
            ExUtil.warn(log, "Unable to access node: " + _id, e);
        }

        if (node != null) {
            if (_hasUrlId) {
                config.setInitialNodeId(_id);
            }
            if (AclService.isPublic(node)) {
                svc_render.populateSocialCardProps(node, model);
            }
        } else {
            config.setUserMsg("Unable to open node: " + _id);
        }

        if (signupCode != null) {
            config.setUserMsg(svc_user.processSignupCode(signupCode));
        }

        // This is how we send arbitrary configuration information to the browser
        config.setConfig(svc_prop.getConfig());
        config.setBrandingAppName(svc_prop.getConfigText("brandingAppName"));
        config.setPaymentLink(svc_prop.getStripePaymentLink());
        config.setRequireCrypto(svc_prop.isRequireCrypto());
        // #ai-model
        config.setUseOpenAi(!StringUtils.isEmpty(svc_prop.getOpenAiKey()));
        config.setUsePplxAi(!StringUtils.isEmpty(svc_prop.getPplxAiKey()));
        config.setUseGeminiAi(!StringUtils.isEmpty(svc_prop.getGeminiAiKey()));
        config.setUseAnthAi(!StringUtils.isEmpty(svc_prop.getAnthAiKey()));
        config.setUseXAi(!StringUtils.isEmpty(svc_prop.getXAiKey()));
        config.setSearch(search);
        config.setLogin(login);
        config.setUrlView(view);
        config.setAiAgentEnabled(svc_prop.getAiAgentEnabled());
        config.setQaiDataFolder(svc_prop.getQaiDataFolder());
        config.setQaiProjectsFolder(svc_prop.getQaiProjectsFolder());
        config.setUserGuideUrl(svc_prop.getUserGuideUrl());

        attrs.put("g_config", config);
        model.addAllAttributes(attrs);
        return "index";
    }

    public HashMap<String, Object> getThymeleafAttribs() {
        HashMap<String, Object> map = new HashMap<>();
        map.put("instanceId", svc_prop.getInstanceId());
        map.put("brandingAppName", svc_prop.getConfigText("brandingAppName"));
        map.put("brandingMetaContent", svc_prop.getConfigText("brandingMetaContent"));
        return map;
    }

    /**
     * Renders a node based on the provided request. This is the call that gets all the data to show on
     * a page. Whenever user is browsing to a new page, this method gets called once per page and
     * retrieves all the data for that page.
     *
     * @param req the request containing parameters for rendering the node
     * @return the response containing the rendered node information
     */
    public RenderNodeResponse cm_renderNode(RenderNodeRequest req) {
        RenderNodeResponse res = new RenderNodeResponse();
        // by default we do showReplies
        boolean showReplies = true;
        boolean adminOnly = false;
        SessionContext sc = TL.getSC();
        HashMap<String, AccountNode> accountNodeMap = new HashMap<>();

        // this is not anon user, we set the flag based on their preferences
        if (sc != null && !sc.isAnon()) {
            showReplies = sc.getUserPreferences().isShowReplies();
        }
        String targetId = req.getNodeId();
        boolean isActualUplevelRequest = req.isUpLevel();
        SubNode node = svc_mongoRead.getNode(targetId);

        if (node == null && !sc.isAnon()) {
            node = svc_mongoRead.getNode(sc.getUserNodeId());
        }
        adminOnly = svc_acl.isAdminOwned(node);

        // If this request is indicates the server would rather display RSS than jump to an RSS node itself,
        // then here we indicate to the caller this happened and return immediately.
        if (req.isJumpToRss() && node != null && NodeType.RSS_FEED.s().equals(node.getType())) {
            res.setRssNode(true);
            NodeInfo nodeInfo = svc_convert.toNodeInfo(adminOnly, TL.getSC(), node, false,
                    Convert.LOGICAL_ORDINAL_IGNORE, false, false, false, true, accountNodeMap);
            res.setNode(nodeInfo);
            return res;
        }
        if (node == null) {
            log.debug("nodeId not found: " + targetId + " sending user to :public instead");
            node = svc_mongoRead.getNode(svc_prop.getUserLandingPageNode());
        }
        if (node == null) {
            res.setNoDataResponse("Node not found.");
            return res;
        }

        svc_mongoRead.forceCheckHasChildren(node);

        /* If only the single node was requested return that */
        if (req.isSingleNode()) {
            // that loads these all asynchronously.
            NodeInfo nodeInfo = svc_convert.toNodeInfo(adminOnly, TL.getSC(), node, false,
                    Convert.LOGICAL_ORDINAL_GENERATE, false, false, false, true, accountNodeMap);
            res.setNode(nodeInfo);
            return res;
        }
        /*
         * If scanToNode is non-null it means we are trying to get a subset of the children that contains
         * scanToNode as one child, because that's the child we want to highlight and scroll to on the front
         * end when the query returns, and the page root node will of course be the parent of scanToNode
         */
        SubNode scanToNode = null;
        if (req.isForceRenderParent()) {
            req.setUpLevel(true);
        }
        /*
         * the 'siblingOffset' is for jumping forward or backward thru at the same level of the tree without
         * having to first 'uplevel' and then click on the prev or next node.
         */
        if (req.getSiblingOffset() != 0) {
            SubNode parent = svc_mongoRead.getParent(node);
            if (req.getSiblingOffset() < 0) {
                SubNode nodeAbove = svc_mongoRead.getSiblingAbove(node, parent);
                if (nodeAbove != null) {
                    node = nodeAbove;
                } else {
                    node = parent != null ? parent : node;
                }
            } //
            else if (req.getSiblingOffset() > 0) {
                SubNode nodeBelow = svc_mongoRead.getSiblingBelow(node, parent);
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
                    SubNode parent = svc_mongoRead.getParent(node);
                    if (parent != null) {
                        scanToNode = node;
                        node = parent;
                    }
                } catch (Exception e) {
                    /*
                     * failing to get parent is only an "auth" problem if this was an ACTUAL uplevel request, and not
                     * something we decided to to inside this method based on trying not to render a page with no
                     * children showing.
                     */
                    if (isActualUplevelRequest) {
                        throw new ForbiddenException();
                    }
                }
            }
        }
        int limit = ConstantInt.ROWS_PER_PAGE.val();

        LinkedList<BreadcrumbInfo> breadcrumbs = new LinkedList<>();
        res.setBreadcrumbs(breadcrumbs);
        svc_render.getBreadcrumbs(node, breadcrumbs);
        NodeInfo nodeInfo = svc_render.processRenderNode(adminOnly, req, res, node, scanToNode, -1, 0, limit,
                showReplies, accountNodeMap);
        if (nodeInfo != null) {
            res.setNode(nodeInfo);
        } else {
            res.setCode(HttpServletResponse.SC_EXPECTATION_FAILED);
        }
        return res;
    }

    /**
     * Processes and renders a node, including its children, based on the given parameters.
     *
     * @param adminOnly Indicates if the operation is restricted to admin users only.
     * @param req The request object containing parameters for rendering the node.
     * @param res The response object to store the results of the rendering process.
     * @param node The node to be processed and rendered.
     * @param scanToNode The node to scan to, if applicable.
     * @param logicalOrdinal The logical ordinal position of the node.
     * @param level The depth level of the node in the hierarchy.
     * @param limit The maximum number of child nodes to render.
     * @param showReplies Indicates if replies (child nodes) should be shown.
     * @param accountNodeMap A map of account nodes for reference.
     * @return A NodeInfo object containing the rendered node information, or null if the node cannot be
     *         rendered.
     */
    public NodeInfo processRenderNode(boolean adminOnly, RenderNodeRequest req, RenderNodeResponse res, SubNode node,
            SubNode scanToNode, long logicalOrdinal, int level, int limit, boolean showReplies,
            HashMap<String, AccountNode> accountNodeMap) {
        NodeInfo nodeInfo = svc_convert.toNodeInfo(adminOnly, TL.getSC(), node, false, logicalOrdinal, level > 0, false,
                false, true, accountNodeMap);
        if (nodeInfo == null) {
            return null;
        }
        if (level > 0) {
            return nodeInfo;
        }
        nodeInfo.setChildren(new LinkedList<>());
        /*
         * If we are scanning to a node we know we need to start from zero offset, or else we use the offset
         * passed in. Offset is the number of nodes to IGNORE before we start collecting nodes.
         */
        int offset = scanToNode != null ? 0 : req.getOffset();
        if (offset < 0) {
            offset = 0;
        }
        /*
         * todo-2: need optimization to work well with large numbers of child nodes: If scanToNode is in
         * use, we should instead look up the node itself, and then get it's ordinal, and use that as a '>='
         * in the query to pull up the list when the node ordering is ordinal. Note, if sort order is by a
         * timestamp we'd need a ">=" on the timestamp itself instead. We request ROWS_PER_PAGE+1, because
         * that is enough to trigger 'endReached' logic to be set correctly
         */
        int queryLimit = scanToNode != null ? -1 : limit + 1;
        String orderBy = node.getStr(NodeProp.ORDER_BY);
        Sort sort = null;
        if (!StringUtils.isEmpty(orderBy)) {
            sort = parseOrderBy(orderBy);
        }
        boolean isOrdinalOrder = false;
        if (sort == null) {
            sort = Sort.by(Sort.Direction.ASC, SubNode.ORDINAL);
            isOrdinalOrder = true;
        }
        Criteria moreCriteria = null;
        /*
         * #optional-show-replies: disabling this for now. Needs more thought regarding how to keep this
         * from accidentally hiding nodes from users in a way where they don't realize nodes are being
         * hidden simply because of being comment types. especially with the 'Show Comments' being hidden
         * away in the settings menu instead of like at the top of the tree view like document view does.
         */
        // if (!showReplies) {
        // moreCriteria = Criteria.where(SubNode.TYPE).ne(NodeType.COMMENT.s());
        // }
        Iterable<SubNode> nodeIter = svc_mongoRead.getChildren(node, sort, queryLimit, offset, moreCriteria);
        Iterator<SubNode> iterator = nodeIter.iterator();
        int idx = offset;
        // this should only get set to true if we run out of records, because we reached
        // the true end of records and not related to a queryLimit
        boolean endReached = false;
        if (req.isGoToLastPage()) {
            // todo-2: fix
            throw new RuntimeEx("Last page access not implemented yet.");
        }

        List<SubNode> slidingWindow = null;
        NodeInfo ninfo = null;
        // -1 means "no last ordinal known" (i.e. first iteration)
        long lastOrdinal = -1;
        BulkOperations bops = null;
        int batchSize = 0;
        // Main loop to keep reading nodes from the database until we have enough to render the page
        while (true) {
            if (!iterator.hasNext()) {
                endReached = true;
                break;
            }
            SubNode n = iterator.next();
            /*
             * Side Effect: Fixing Duplicate Ordinals
             * 
             * we do the side effect of repairing ordinals here just because it's really only an issue if it's
             * rendered and here's where we're rendering. It would be 'possible' but less performant to just
             * detect when a node's children have dupliate ordinals, and fix the entire list of children
             */
            if (isOrdinalOrder) {
                if (lastOrdinal != -1 && lastOrdinal == n.getOrdinal()) {
                    lastOrdinal++;
                    // add to bulk ops this: n.ordinal = lastOrdinal + 1;
                    if (bops == null) {
                        bops = svc_ops.bulkOps(BulkMode.UNORDERED);
                    }
                    Criteria crit = new Criteria("id").is(n.getId());
                    crit = svc_auth.addReadSecurity(crit);
                    Query query = new Query().addCriteria(crit);
                    Update update = new Update().set(SubNode.ORDINAL, lastOrdinal);
                    bops.updateOne(query, update);
                    if (++batchSize > Const.MAX_BULK_OPS) {
                        bops.execute();
                        batchSize = 0;
                        bops = null;
                    }
                } else {
                    lastOrdinal = n.getOrdinal();
                }
            }
            idx++;
            // log.debug("Iterate [" + idx + "]: nodeId" + n.getIdStr() + "scanToNode=" +
            // scanToNode); are we still just scanning for our target node
            if (scanToNode != null) {
                // If this is the node we are scanning for turn off scan mode, and add up to ROWS_PER_PAGE-1 of
                // any sliding window nodes above it.
                if (n.getPath().equals(scanToNode.getPath())) {
                    scanToNode = null;
                    if (slidingWindow != null) {
                        int count = slidingWindow.size();
                        if (count > 0) {
                            int relativeIdx = idx - 1;
                            for (int i = count - 1; i >= 0; i--) {
                                SubNode sn = slidingWindow.get(i);
                                relativeIdx--;
                                ninfo = svc_render.processRenderNode(adminOnly, req, res, sn, null, relativeIdx,
                                        level + 1, limit, showReplies, accountNodeMap);
                                nodeInfo.getChildren().add(0, ninfo);

                                /*
                                 * If we have enough records we're done. Note having ">= ROWS_PER_PAGE/2" for example
                                 * would also work and would bring back the target node as close to the center of the
                                 * results sent back to the brower as possible, but what we do instead is just set to
                                 * ROWS_PER_PAGE which maximizes performance by iterating the smallese number of results
                                 * in order to get a page that contains what we need (namely the target node as indiated
                                 * by scanToNode item)
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
                // else, we can continue while loop after we incremented 'idx'. Nothing else to do on this
                // iteration/node
                else {
                    // lazily create sliding window
                    if (slidingWindow == null) {
                        slidingWindow = new LinkedList<>();
                    }
                    // update sliding window
                    slidingWindow.add(n);
                    if (slidingWindow.size() > limit) {
                        slidingWindow.remove(0);
                    }
                    continue;
                }
            }
            // if we get here we're accumulating rows
            ninfo = svc_render.processRenderNode(adminOnly, req, res, n, null, idx - 1L, level + 1, limit, showReplies,
                    accountNodeMap);
            nodeInfo.getChildren().add(ninfo);
            if (!iterator.hasNext()) {
                // since we query for 'limit+1', we will end up here if we're at the true end of the records.
                endReached = true;
                break;
            }
            if (nodeInfo.getChildren().size() >= limit) {
                // break out of while loop, we have enough children to send back
                break;
            }
        }
        // if we accumulated less than ROWS_PER_PAGE, then try to scan back up the sliding window to build
        // up the ROW_PER_PAGE by looking at nodes that we encountered before we reached the end.
        if (slidingWindow != null && nodeInfo.getChildren().size() < limit) {
            int count = slidingWindow.size();
            if (count > 0) {
                int relativeIdx = idx - 1;

                for (int i = count - 1; i >= 0; i--) {
                    SubNode sn = slidingWindow.get(i);
                    relativeIdx--;
                    ninfo = svc_render.processRenderNode(adminOnly, req, res, sn, null, (long) relativeIdx, level + 1,
                            limit, showReplies, accountNodeMap);
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
        if (endReached && ninfo != null && nodeInfo.getChildren().size() > 0) {
            // set 'lastChild' on the last child
            nodeInfo.getChildren().get(nodeInfo.getChildren().size() - 1).setLastChild(true);
        }
        // log.debug("Setting endReached="+endReached);
        res.setEndReached(endReached);
        if (bops != null) {
            bops.execute();
        }
        return nodeInfo;
    }

    /**
     * Parses the given orderBy string to create a Sort object. The orderBy string should be in the
     * format "property direction", where direction is either "asc" or "desc". If the direction is not
     * specified, it defaults to "asc".
     * 
     * Nodes can have a propety like orderBy="priority asc", and that allow the children to be displayed
     * in that order.
     *
     * parses something like "priority asc" into a Sort object, assuming the field is in the property
     * array of the node, rather than the name of an actual SubNode object member property.
     * 
     * @param orderBy the string specifying the property and direction to sort by
     * @return a Sort object representing the sorting order
     */
    private Sort parseOrderBy(String orderBy) {
        Sort sort = null;
        int spaceIdx = orderBy.indexOf(" ");
        String dir = "asc"; // asc or desc
        if (spaceIdx != -1) {
            String orderByProp = orderBy.substring(0, spaceIdx);
            dir = orderBy.substring(spaceIdx + 1);
            sort = Sort.by(dir.equals("asc") ? Sort.Direction.ASC : Sort.Direction.DESC,
                    SubNode.PROPS + "." + orderByProp);
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

    /*
     * There is a system defined way for admins to specify what node should be displayed in the browser
     * when a non-logged in user (i.e. anonymouse user) is browsing the site, and this method retrieves
     * that page data.
     */
    public RenderNodeResponse cm_anonPageLoad(RenderNodeRequest req) {
        if (req.getNodeId() == null) {
            String id = svc_prop.getUserLandingPageNode();
            req.setNodeId(id);
        }
        return cm_renderNode(req);
    }

    /**
     * Populates the social card properties of a given node into the provided model.
     *
     * @param node the node containing the information to populate the social card properties
     * @param model the model to which the social card properties will be added
     */
    public void populateSocialCardProps(SubNode node, Model model) {
        if (node == null)
            return;
        NodeMetaInfo metaInfo = svc_snUtil.getNodeMetaInfo(node);
        model.addAttribute("ogTitle", metaInfo.getTitle());
        model.addAttribute("ogDescription", metaInfo.getDescription());
        String mime = metaInfo.getAttachmentMime();
        if (mime != null && mime.startsWith("image/")) {
            model.addAttribute("ogImage", metaInfo.getAttachmentUrl());
        }
        model.addAttribute("ogUrl", metaInfo.getUrl());
    }

    /**
     * Renders a calendar based on the provided request.
     *
     * @param req the request containing the node ID for which the calendar is to be rendered
     * @return a response containing the rendered calendar items
     */
    public RenderCalendarResponse cm_renderCalendar(RenderCalendarRequest req) {
        RenderCalendarResponse res = new RenderCalendarResponse();
        SubNode node = svc_mongoRead.getNode(req.getNodeId());
        if (node == null) {
            return res;
        }
        LinkedList<CalendarItem> items = new LinkedList<>();
        res.setItems(items);

        for (SubNode n : svc_mongoRead.getCalendar(node)) {
            CalendarItem item = new CalendarItem();
            String content = n.getContent();
            content = svc_render.getFirstLineAbbreviation(content, 50);
            item.setTitle(content);
            item.setId(n.getIdStr());
            item.setStart(n.getInt(NodeProp.DATE));
            String durationStr = n.getStr(NodeProp.DURATION);
            long duration = DateUtil.getMillisFromDuration(durationStr);
            if (duration == 0) {
                duration = 60 * 60 * 1000;
            }
            item.setEnd(item.getStart() + duration);
            items.add(item);
        }
        return res;
    }

    /**
     * Generates a list of breadcrumb information for the given node and its ancestors.
     *
     * @param node the starting node for which breadcrumbs are to be generated
     * @param list the list to which breadcrumb information will be added
     */
    public void getBreadcrumbs(SubNode node, LinkedList<BreadcrumbInfo> list) {
        try {
            if (node != null) {
                node = svc_mongoRead.getParent(node);
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
                if (StringUtils.isEmpty(content)) {
                    if (!StringUtils.isEmpty(node.getName())) {
                        content = node.getName();
                    } else {
                        content = "[empty]";
                    }
                } else if (content.startsWith(Constant.ENC_TAG.s())) {
                    content = "[encrypted]";
                } else {
                    content = getFirstLineAbbreviation(content, 25);
                }
                bci.setName(content);
                bci.setId(node.getIdStr());
                bci.setType(node.getType());
                list.add(0, bci);
                node = svc_mongoRead.getParent(node);
            }
        } catch (Exception e) {
        }
    }

    /**
     * Used to strip off any leading hashtags or usernames from the content of a node.
     */
    public String stripRenderTags(String content) {
        if (content == null)
            return null;
        content = content.trim();

        while (content.startsWith("#")) {
            content = XString.stripIfStartsWith(content, "#");
        }
        content = content.trim();
        return content;
    }

    /**
     * This is used to generate the first line of a node's content to be used as the title of the node
     * in the tree view. It is also used to generate the title of the page when the node is rendered in
     * the browser.
     */
    public String getFirstLineAbbreviation(String input, int maxLen) {
        if (input == null || input.isEmpty()) {
            return "";
        }

        int runLen = 0;
        int start = -1;
        int length = input.length();
        int lastWordBreak = -1;

        for (int i = 0; i < length; i++) {
            char c = input.charAt(i);

            if (c == ' ' && runLen > 0) {
                lastWordBreak = i;
            }

            if (XString.isContentChar(c) || (runLen > 0 && (c == ' ' || c == '\''))) {
                if (runLen == 0) {
                    start = i;
                }
                runLen++;
                if (runLen == maxLen) {
                    break;
                }
            } else {
                if (runLen > 3) {
                    break;
                }
                runLen = 0;
                start = -1;
            }
        }

        return runLen > 0
                ? input.substring(start, (lastWordBreak != -1 && runLen == maxLen) ? lastWordBreak : start + runLen)
                : "";
    }
}
