package quanta.mongo;

import java.util.Arrays;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.BulkOperations.BulkMode;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;
import quanta.actpub.APConst;
import quanta.config.NodeName;
import quanta.config.ServiceBase;
import quanta.exception.ForbiddenException;
import quanta.model.PropertyInfo;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.model.client.openai.ChatCompletionResponse;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.SubNode;
import quanta.request.CreateSubNodeRequest;
import quanta.request.InsertNodeRequest;
import quanta.response.CreateSubNodeResponse;
import quanta.response.InsertNodeResponse;
import quanta.service.AclService;
import quanta.types.TypeBase;
import quanta.util.Const;
import quanta.util.Convert;
import quanta.util.ThreadLocals;
import quanta.util.val.Val;

/**
 * Performs the 'create' (as in CRUD) operations for creating new nodes in MongoDB
 */
@Component
public class MongoCreate extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(MongoCreate.class);
    /*
     * this large top reserve size means the "insert at top" will always be done with out multiple node
     * updates except for once every thousand times.
     */
    private static long RESERVE_BLOCK_SIZE = 1000;

    public SubNode createNode(MongoSession ms, SubNode parent, String type, Long ordinal, CreateNodeLocation location,
            boolean updateParentOrdinals) {
        return createNode(ms, parent, null, type, ordinal, location, null, null, updateParentOrdinals, true);
    }

    public SubNode createNode(MongoSession ms, String path) {
        SubNode node = new SubNode(ms.getUserNodeId(), path, NodeType.NONE.s(), null);
        update.updateParentHasChildren(node);
        return node;
    }

    public SubNode createNode(MongoSession ms, String path, String type) {
        if (type == null) {
            type = NodeType.NONE.s();
        }
        SubNode node = new SubNode(ms.getUserNodeId(), path, type, null);
        update.updateParentHasChildren(node);
        return node;
    }

    /*
     * Creates a node, but does NOT persist it. If parent==null it assumes it's adding a root node. This
     * is required, because all the nodes at the root level have no parent. That is, there is no ROOT
     * node. Only nodes considered to be on the root.
     *
     * relPath can be null if no path is known
     */
    public SubNode createNode(MongoSession ms, SubNode parent, String relPath, String type, Long ordinal,
            CreateNodeLocation location, List<PropertyInfo> properties, ObjectId ownerId, boolean updateOrdinals,
            boolean updateParent) {
        if (relPath == null) {
            /*
             * Adding a node ending in '?' will trigger for the system to generate a leaf node automatically.
             */
            relPath = "?";
        }
        if (type == null) {
            type = NodeType.NONE.s();
        }
        String path = (parent == null ? "" : parent.getPath()) + "/" + relPath;
        if (ownerId == null) {
            ownerId = ms.getUserNodeId();
        }
        // for now not worried about ordinals for root nodes.
        if (parent == null) {
            ordinal = 0L;
        } else {
            if (updateOrdinals) {
                if (ordinal == null) {
                    ordinal = 0L;
                }
                Long _ordinal = ordinal;
                ordinal = (Long) arun.run(as -> {
                    return create.prepOrdinalForLocation(as, location, parent, _ordinal);
                });
            }
        }

        SubNode node = new SubNode(ownerId, path, type, ordinal);
        if (updateParent && parent != null) {
            parent.setHasChildren(true);

            // todo-1: I noticed it seems like parent is not getting set sometimes, namely when OpenAi is
            // creating a node response, so I need to investigate what's going on. For now this is a workaround
            update.saveSession(ms);
        }

        if (properties != null) {
            for (PropertyInfo propInfo : properties) {
                node.set(propInfo.getName(), propInfo.getValue());
            }
        }
        return node;
    }

    private Long prepOrdinalForLocation(MongoSession ms, CreateNodeLocation location, SubNode parent, Long ordinal) {
        switch (location) {
            case FIRST:
                ordinal = create.insertOrdinal(ms, parent, 0L, 1L);
                break;
            case LAST:
                ordinal = read.getMaxChildOrdinal(ms, parent) + 1;
                break;
            case ORDINAL:
                ordinal = create.insertOrdinal(ms, parent, ordinal, 1L);
                break;
            default:
                throw new RuntimeException("Unknown ordinal");
        }
        update.saveSession(ms);
        return ordinal;
    }

    /*
     * Shifts all child ordinals down (increments them by rangeSize), that are >= 'ordinal' to make a
     * slot for the new ordinal positions for some new nodes to be inserted into this newly available
     * range of unused sequential ordinal values (range of 'ordinal+1' thru 'ordinal+1+rangeSize')
     *
     * Example: Inserting at top will normally send the ordinal in that's the same as the current TOP
     * ordinal, so the new node will occupy that slot and everythnig else shifts down.
     *
     * Returns the first ordinal in the range we actually ended up freeing up for use.
     */
    public long insertOrdinal(MongoSession ms, SubNode node, long ordinal, long rangeSize) {
        long minOrdinal = read.getMinChildOrdinal(ms, node);
        // default new ordinal to ordinal
        long newOrdinal = ordinal;
        /*
         * We detect the special case where we're attempting to insert at 'top' ordinals and if we find room
         * to grab an ordinal at minOrdinal-1 then we do so. Whenever Quanta renumbers nodes it tries to
         * leave RESERVE_BLOCK_SIZE at the head so that inserts "at top" will alway some in as 999, 998,
         * 997, etc, until it's forced to renumber, when the top node happens to have zero ordinal and we
         * end up trying to insert above it.
         */
        // if we're inserting a single node
        if (rangeSize == 1) {
            // if the target ordinal is at or below the current minimum
            if (ordinal <= minOrdinal) {
                // if we have space below the current minimum we can just use it
                if (minOrdinal > 0) {
                    long ret = minOrdinal - 1;
                    // always grab the index at halfway to zero so we can leave room for for future inserts to
                    // get lucky and have a place to land without cusing a multi record node renumbering.
                    if (ret > 0) {
                        ret = ret / 2;
                    }
                    return ret;
                } else { // "INSERT_BLOCK_SIZE - 1" be the topmost ordinal now // else minOrdinal is already at zero so
                         // we insert a new block, and then let
                    rangeSize = RESERVE_BLOCK_SIZE;
                    newOrdinal = RESERVE_BLOCK_SIZE - 1;
                }
            }
        }
        auth.auth(ms, node, PrivilegeType.READ);
        // save all if there's any to save.
        update.saveSession(ms);
        Criteria crit = Criteria.where(SubNode.ORDINAL).gte(ordinal);
        BulkOperations bops = null;
        int batchSize = 0;

        for (SubNode child : read.getChildren(ms, node, Sort.by(Sort.Direction.ASC, SubNode.ORDINAL), null, 0, crit,
                false)) {
            // lazy create bulkOps
            if (bops == null) {
                bops = opsw.bulkOps(BulkMode.UNORDERED, SubNode.class);
            }

            Query query = new Query().addCriteria(new Criteria("id").is(child.getId()));
            Update update = new Update().set(SubNode.ORDINAL, child.getOrdinal() + rangeSize);
            bops.updateOne(query, update);
            if (++batchSize > Const.MAX_BULK_OPS) {
                bops.execute();
                batchSize = 0;
                bops = null;
            }
        }
        if (bops != null) {
            bops.execute();
        }
        return newOrdinal;
    }

    /*
     * Creates a new node as a *child* node of the node specified in the request. Should ONLY be called
     * by the controller that accepts a node being created by the GUI/user
     */
    public CreateSubNodeResponse createSubNode(MongoSession ms, CreateSubNodeRequest req) {
        CreateSubNodeResponse res = new CreateSubNodeResponse();
        boolean linkBookmark = "linkBookmark".equals(req.getPayloadType());
        String nodeId = req.getNodeId();
        boolean makePublicWritable = false;
        boolean allowSharing = true;
        boolean forceInheritSharing = false;

        /*
         * note: parentNode and nodeBeingReplied to are not necessarily the same. 'parentNode' is the node
         * that will HOLD the reply, but may not always be WHAT is being replied to.
         */
        SubNode parentNode = null;
        SubNode nodeBeingRepliedTo = null;
        if (req.isReply()) {
            nodeBeingRepliedTo = read.getNode(ms, nodeId);
        }
        /*
         * If this is a "New Post" from the Feed tab we get here with no ID but we put this in user's
         * "My Posts" node, and the other case is if we are doing a reply we also will put the reply in the
         * user's POSTS node.
         */
        if (nodeId == null && !linkBookmark) {
            parentNode = read.getUserNodeByType(ms, null, null,
                    "### " + ThreadLocals.getSC().getUserName() + "'s Public Posts", NodeType.POSTS.s(),
                    Arrays.asList(PrivilegeType.READ.s()), NodeName.POSTS, true);

            if (parentNode != null) {
                nodeId = parentNode.getIdStr();
                makePublicWritable = true;
            }
        }

        /* Node still null, then try other ways of getting it */
        if (parentNode == null && !linkBookmark) {
            if (nodeId != null && nodeId.equals("~" + NodeType.NOTES.s())) {
                parentNode = read.getUserNodeByType(ms, ms.getUserName(), null, "### Notes", NodeType.NOTES.s(), null,
                        null, false);
            } else {
                parentNode = read.getNode(ms, nodeId);
            }
        }

        // lets the type override the location where the node is created.
        TypeBase plugin = typePluginMgr.getPluginByType(req.getTypeName());
        if (plugin != null) {
            Val<SubNode> vcNode = new Val<>(parentNode);
            plugin.preCreateNode(ms, vcNode, req, linkBookmark);
            parentNode = vcNode.getVal();
        }
        if (parentNode == null) {
            throw new RuntimeException("unable to locate parent for insert");
        }

        // if user is adding a node under one of their parent nodes then we inherit the sharing
        if (parentNode.getOwner().equals(ms.getUserNodeId())) {
            forceInheritSharing = true;
        }

        ChatCompletionResponse aiAnswer = null;
        String typeToCreate = req.getTypeName();
        if (req.isOpenAiQuestion()) {
            // if this is a regular node and not an openai reply node, then we are asking the text on this
            // existing node as a new question.
            if (NodeType.NONE.s().equals(parentNode.getType())) {
                aiAnswer = oai.getOpenAiAnswer(ms, parentNode, null);
                res.setGptCredit(aiAnswer.userCredit);
                typeToCreate = NodeType.OPENAI_ANSWER.s();
            }
        }

        auth.writeAuth(ms, parentNode);
        parentNode.adminUpdate = true;
        // note: redundant security
        if (acl.isAdminOwned(parentNode) && !ms.isAdmin()) {
            throw new ForbiddenException();
        }
        CreateNodeLocation createLoc = req.isCreateAtTop() ? CreateNodeLocation.FIRST : CreateNodeLocation.LAST;
        SubNode newNode = create.createNode(ms, parentNode, null, typeToCreate, 0L, createLoc, req.getProperties(),
                null, true, true);
        if (req.isPendingEdit()) {
            mongoUtil.setPendingPath(newNode, true);
        }

        if (aiAnswer != null) {
            newNode.setContent(oai.formatAnswer(aiAnswer, true));
            newNode.set(NodeProp.OPENAI_RESPONSE, aiAnswer);
        } else {
            newNode.setContent(req.getContent() != null ? req.getContent() : "");
        }
        newNode.touch();

        // NOTE: Be sure to get nodeId off 'req' here, instead of the var
        if (req.isReply() && req.getNodeId() != null) {
            newNode.set(NodeProp.INREPLYTO, req.getNodeId());
        }

        if (NodeType.BOOKMARK.s().equals(req.getTypeName())) {
            newNode.set(NodeProp.TARGET_ID, req.getNodeId());
            // adding bookmark should disallow sharing.
            allowSharing = false;
        }

        if (req.isTypeLock()) {
            newNode.set(NodeProp.TYPE_LOCK, Boolean.valueOf(true));
        }

        // if we never set 'nodeBeingRepliedTo' by now that means it's the parent that we're replying to.
        if (nodeBeingRepliedTo == null) {
            nodeBeingRepliedTo = parentNode;
        }

        if (allowSharing && aiAnswer == null) {
            // if a user to share to (a Direct Message) is provided, add it.
            if (req.getShareToUserId() != null) {
                HashMap<String, AccessControl> ac = new HashMap<>();
                ac.put(req.getShareToUserId(), new AccessControl(null, APConst.RDWR));
                newNode.setAc(ac);
            } else if (req.isReply() || forceInheritSharing) {
                acl.inheritSharingFromParent(ms, req, res, nodeBeingRepliedTo, newNode);
            }

            /* Always make public if we're replying to public node or posting under our POSTs node */
            if (!req.isDirectMessage()
                    && (makePublicWritable || (req.isReply() && AclService.isPublic(nodeBeingRepliedTo))
                            || parentNode.isType(NodeType.POSTS))) {
                acl.addPrivilege(ms, null, newNode, PrincipalName.PUBLIC.s(), null,
                        Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
            }
        }

        if (!StringUtils.isEmpty(req.getBoostTarget())) {
            /* If the node being boosted is itself a boost then boost the original boost instead */
            SubNode nodeToBoost = read.getNode(ms, req.getBoostTarget());
            if (nodeToBoost != null) {
                String innerBoost = nodeToBoost.getStr(NodeProp.BOOST);
                newNode.set(NodeProp.BOOST, innerBoost != null ? innerBoost : req.getBoostTarget());
            }
        }
        openGraph.parseNode(newNode, true);

        if (NodeType.CALENDAR.s().equals(parentNode.getType())) {
            // if parent is a calendar node, then we need to set the date on this new node
            newNode.set(NodeProp.DATE, Calendar.getInstance().getTime().getTime());
            newNode.set(NodeProp.DURATION, "01:00");
        }

        update.save(ms, newNode);

        if (req.isOpenAiQuestion() && NodeType.OPENAI_ANSWER.s().equals(parentNode.getType())) {
            oai.insertAnswerToQuestion(ms, newNode, req, res);
        }

        /*
         * if this is a boost node being saved, then immediately run processAfterSave, because we won't be
         * expecting any final 'saveNode' to ever get called (like when user clicks "Save" in node editor),
         * because this node will already be final and the user won't be editing it. It's done and ready to
         * publish out to foreign servers
         */
        if (!req.isPendingEdit() && req.getBoostTarget() != null) {
            edit.processAfterSave(ms, newNode, parentNode);
        }
        res.setNewNode(convert.toNodeInfo(false, ThreadLocals.getSC(), ms, newNode, false, //
                req.isCreateAtTop() ? 0 : Convert.LOGICAL_ORDINAL_GENERATE, false, false, false, false, false, null,
                false));
        return res;
    }

    /*
     * Creates a new node that is a sibling (same parent) of and at the same ordinal position as the
     * node specified in the request. Should ONLY be called by the controller that accepts a node being
     * created by the GUI/user
     */
    public InsertNodeResponse insertNode(MongoSession ms, InsertNodeRequest req) {
        InsertNodeResponse res = new InsertNodeResponse();
        String parentNodeId = req.getParentId();
        log.debug("Inserting under parent: " + parentNodeId);
        SubNode parentNode = read.getNode(ms, parentNodeId);
        if (parentNode == null) {
            throw new RuntimeException("Unable to find parent note to insert under: " + parentNodeId);
        }
        auth.writeAuth(ms, parentNode);
        parentNode.adminUpdate = true;
        // note: redundant security
        if (acl.isAdminOwned(parentNode) && !ms.isAdmin()) {
            throw new ForbiddenException();
        }
        SubNode newNode = create.createNode(ms, parentNode, null, req.getTypeName(), req.getTargetOrdinal(),
                CreateNodeLocation.ORDINAL, null, null, true, true);
        if (req.getInitialValue() != null) {
            newNode.setContent(req.getInitialValue());
        } else {
            newNode.setContent("");
        }
        newNode.touch();
        // '/r/p/' = pending (nodes not yet published, being edited created by users)
        if (req.isPendingEdit()) {
            mongoUtil.setPendingPath(newNode, true);
        }
        boolean allowSharing = true;
        if (NodeType.BOOKMARK.s().equals(req.getTypeName())) {
            // adding bookmark should disallow sharing.
            allowSharing = false;
        }
        if (allowSharing) {
            // If we're inserting a node under the POSTS it should be public, rather than inherit.
            // Note: some logic may be common between this insertNode() and the createSubNode()
            if (parentNode.isType(NodeType.POSTS)) {
                acl.addPrivilege(ms, null, newNode, PrincipalName.PUBLIC.s(), null,
                        Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
            } else {
                // we always copy the access controls from the parent for any new nodes
                auth.setDefaultReplyAcl(parentNode, newNode);
                // inherit UNPUBLISHED prop from parent, if we own the parent
                if (parentNode.getBool(NodeProp.UNPUBLISHED) && parentNode.getOwner().equals(ms.getUserNodeId())) {
                    newNode.set(NodeProp.UNPUBLISHED, true);
                }
            }
        }

        // createNode might have altered 'hasChildren', so we save if dirty
        update.saveIfDirty(ms, parentNode);
        // We save this right away, before calling convertToNodeInfo in case that method does any Db related
        // stuff where it's expecting the node to exist.
        openGraph.parseNode(newNode, true);

        if (NodeType.CALENDAR.s().equals(parentNode.getType())) {
            // if parent is a calendar node, then we need to set the date on this new node
            newNode.set(NodeProp.DATE, Calendar.getInstance().getTime().getTime());
            newNode.set(NodeProp.DURATION, "01:00");
        }

        update.save(ms, newNode);
        res.setNewNode(convert.toNodeInfo(false, ThreadLocals.getSC(), ms, newNode, false, //
                Convert.LOGICAL_ORDINAL_GENERATE, false, false, false, false, false, null, false));

        return res;
    }
}
