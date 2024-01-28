package quanta.mongo;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
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
import quanta.config.ServiceBase;
import quanta.exception.ForbiddenException;
import quanta.model.PropertyInfo;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.model.client.huggingface.HuggingFaceResponse;
import quanta.model.client.openai.ChatCompletionResponse;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.SubNode;
import quanta.request.CreateSubNodeRequest;
import quanta.request.InsertNodeRequest;
import quanta.response.CreateSubNodeResponse;
import quanta.response.InsertNodeResponse;
import quanta.response.base.NodeChanges;
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
            boolean updateParentOrdinals, NodeChanges nodeChanges) {
        return createNode(ms, parent, null, type, ordinal, location, null, null, updateParentOrdinals, true,
                nodeChanges);
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
            boolean updateParent, NodeChanges nodeChanges) {
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
                    return create.prepOrdinalForLocation(as, location, parent, _ordinal, nodeChanges);
                });
            }
        }

        SubNode node = new SubNode(ownerId, path, type, ordinal);
        if (updateParent && parent != null) {
            parent.setHasChildren(true);

            // todo-2: I noticed it seems like parent is not getting set sometimes, namely when OpenAi is
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

    private Long prepOrdinalForLocation(MongoSession ms, CreateNodeLocation location, SubNode parent, Long ordinal,
            NodeChanges nodeChanges) {
        switch (location) {
            case FIRST:
                ordinal = create.insertOrdinal(ms, parent, 0L, 1L, nodeChanges);
                break;
            case LAST:
                ordinal = read.getMaxChildOrdinal(ms, parent) + 1;
                break;
            case ORDINAL:
                ordinal = create.insertOrdinal(ms, parent, ordinal, 1L, nodeChanges);
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
    public long insertOrdinal(MongoSession ms, SubNode node, long ordinal, long rangeSize, NodeChanges nodeChanges) {
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

        boolean madeNodeChanges = false;
        for (SubNode child : read.getChildren(ms, node, Sort.by(Sort.Direction.ASC, SubNode.ORDINAL), null, 0, crit,
                false)) {
            // lazy create bulkOps
            if (bops == null) {
                bops = opsw.bulkOps(BulkMode.UNORDERED, SubNode.class);
            }

            Query query = new Query().addCriteria(new Criteria("id").is(child.getId()));
            Update update = new Update().set(SubNode.ORDINAL, child.getOrdinal() + rangeSize);
            madeNodeChanges = true;
            bops.updateOne(query, update);
            if (++batchSize > Const.MAX_BULK_OPS) {
                bops.execute();
                batchSize = 0;
                bops = null;
            }
        }

        if (madeNodeChanges && nodeChanges != null) {
            nodeChanges.setParentNodeId(node.getIdStr());
            nodeChanges.setOrdinalShifMin((int) ordinal);
            nodeChanges.setOrdinalShiftRange((int) rangeSize);
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
        NodeChanges nodeChanges = new NodeChanges();
        res.setNodeChanges(nodeChanges);
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
                    Arrays.asList(PrivilegeType.READ.s()), true);

            if (parentNode != null) {
                nodeId = parentNode.getIdStr();
                makePublicWritable = true;
            }
        }

        /* Node still null, then try other ways of getting it */
        if (parentNode == null && !linkBookmark) {
            if (nodeId != null && nodeId.equals("~" + NodeType.NOTES.s())) {
                parentNode = read.getUserNodeByType(ms, ms.getUserName(), null, "### Notes", NodeType.NOTES.s(), null,
                        false);
            } else {
                parentNode = read.getNode(ms, nodeId);
            }
        }

        // lets the type override the location where the node is created.
        TypeBase plugin = typePluginMgr.getPluginByType(req.getTypeName());
        TypeBase parentPlugin = typePluginMgr.getPluginByType(parentNode.getType());
        if (plugin != null) {
            Val<SubNode> vcNode = new Val<>(parentNode);
            Val<String> vcContent = new Val<>(req.getContent());
            plugin.preCreateNode(ms, vcNode, vcContent, linkBookmark);
            req.setContent(vcContent.getVal());
            parentNode = vcNode.getVal();
        }

        if (parentNode == null) {
            throw new RuntimeException("unable to locate parent for insert");
        }

        // if user is adding a node under one of their parent nodes then we inherit the sharing
        if (parentNode.getOwner().equals(ms.getUserNodeId())) {
            forceInheritSharing = true;
        }

        String typeToCreate = req.getTypeName();
        ChatCompletionResponse openAiAnswer = null;
        ChatCompletionResponse oobAiAnswer = null;
        HuggingFaceResponse huggingFaceAnswer = null;
        // OobaAiResponse oobaAiAnswer = null;

        if ("openAi".equals(req.getAiQuestion())) {
            // if this is a regular node and not an openai reply node, then we are asking the text on this
            // existing node as a new question.
            if (NodeType.NONE.s().equals(parentNode.getType())) {
                openAiAnswer = oai.getOpenAiAnswer(ms, parentNode, null, null);
                res.setGptCredit(openAiAnswer.userCredit);
                typeToCreate = NodeType.OPENAI_ANSWER.s();
            }
        } //
        else if ("huggingFace".equals(req.getAiQuestion())) {
            // if this is a regular node and not an openai reply node, then we are asking the text on this
            // existing node as a new question.
            if (NodeType.NONE.s().equals(parentNode.getType())) {
                huggingFaceAnswer = huggingFace.getAnswer(ms, parentNode, null);
                typeToCreate = NodeType.HUGGINGFACE_ANSWER.s();
            }
        }
        // Oobabooga
        else if ("oobAi".equals(req.getAiQuestion())) {
            // if this is a regular node and not an openai reply node, then we are asking the text on this
            // existing node as a new question.
            if (NodeType.NONE.s().equals(parentNode.getType())) {
                oobAiAnswer = oobaAi.getAnswer(ms, parentNode, null);
                typeToCreate = NodeType.OOBAI_ANSWER.s();
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
                null, true, true, nodeChanges);
        if (req.isPendingEdit()) {
            mongoUtil.setPendingPath(newNode, true);
        }

        // OpenAI
        if (openAiAnswer != null) {
            newNode.setContent(oai.formatAnswer(openAiAnswer, true));
            newNode.set(NodeProp.OPENAI_RESPONSE, openAiAnswer);
        }
        // OobaBooga
        else if (oobAiAnswer != null) {
            newNode.setContent(oai.formatAnswer(oobAiAnswer, true));
            newNode.set(NodeProp.OOBAI_RESPONSE, oobAiAnswer);
        }
        // HuggingFace
        else if (huggingFaceAnswer != null) {
            newNode.setContent(huggingFaceAnswer.getGeneratedText());
            newNode.set(NodeProp.HUGGINGFACE_RESPONSE, huggingFaceAnswer);
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

        if (allowSharing && openAiAnswer == null) {
            // if a user to share to (a Direct Message) is provided, add it.
            if (req.getShareToUserId() != null) {
                HashMap<String, AccessControl> ac = new HashMap<>();
                ac.put(req.getShareToUserId(), new AccessControl(null, Const.RDWR));
                newNode.setAc(ac);
            }
            // isReply really also can mean !parentNode.isMine for current user
            else if (!acl.userOwnsNode(ms, parentNode) || req.isReply() || forceInheritSharing) {
                acl.inheritSharingFromParent(ms, res, nodeBeingRepliedTo, newNode);
            }

            /* Always make public if we're replying to public node or posting under our POSTs node */
            if (!req.isDirectMessage()
                    && (makePublicWritable || (req.isReply() && AclService.isPublic(nodeBeingRepliedTo))
                            || parentNode.isType(NodeType.POSTS))) {
                acl.addPrivilege(ms, null, newNode, PrincipalName.PUBLIC.s(), null,
                        Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
            }
        }
        openGraph.parseNode(newNode, true);

        if (parentPlugin != null) {
            parentPlugin.childCreated(ms, new Val<>(parentNode), new Val<>(newNode));
        }

        update.save(ms, newNode);

        if (req.getAiQuestion() != null && NodeType.OPENAI_ANSWER.s().equals(parentNode.getType())) {
            oai.insertAnswerToQuestion(ms, newNode, req, res);
        }

        res.setNewNode(convert.toNodeInfo(false, ThreadLocals.getSC(), ms, newNode, false, //
                req.isCreateAtTop() ? 0 : Convert.LOGICAL_ORDINAL_GENERATE, false, false, false, false, false));

        return res;
    }

    /*
     * Creates a new node that is a sibling (same parent) of and at the same ordinal position as the
     * node specified in the request. Should ONLY be called by the controller that accepts a node being
     * created by the GUI/user
     */
    public InsertNodeResponse insertNode(MongoSession ms, InsertNodeRequest req) {
        InsertNodeResponse res = new InsertNodeResponse();
        NodeChanges nodeChanges = new NodeChanges();
        res.setNodeChanges(nodeChanges);

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
                CreateNodeLocation.ORDINAL, null, null, true, true, nodeChanges);
        if (req.getInitialValue() != null) {
            newNode.setContent(req.getInitialValue());
        } else {
            newNode.setContent("");
        }
        newNode.touch();
        // pending path (nodes not yet saved by user, being edited/created by users)
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
                acl.inheritSharingFromParent(ms, res, parentNode, newNode);
            }
        }

        // createNode might have altered 'hasChildren', so we save if dirty
        update.saveIfDirty(ms, parentNode);
        // We save this right away, before calling convertToNodeInfo in case that method does any Db related
        // stuff where it's expecting the node to exist.
        openGraph.parseNode(newNode, true);

        TypeBase plugin = typePluginMgr.getPluginByType(req.getTypeName());
        if (plugin != null) {
            Val<SubNode> vcNode = new Val<>(parentNode);
            plugin.preCreateNode(ms, vcNode, null, false);
            parentNode = vcNode.getVal();
        }

        TypeBase parentPlugin = typePluginMgr.getPluginByType(parentNode.getType());

        if (parentPlugin != null) {
            parentPlugin.childCreated(ms, new Val<>(parentNode), new Val<>(newNode));
        }

        // we save right away here so we get the node ID
        update.save(ms, newNode);

        res.setNewNode(convert.toNodeInfo(false, ThreadLocals.getSC(), ms, newNode, false, //
                Convert.LOGICAL_ORDINAL_GENERATE, false, false, false, false, false));
        return res;
    }
}
