package quanta.mongo;

import java.lang.reflect.Constructor;
import java.math.BigDecimal;
import java.util.Arrays;
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
import quanta.config.ServiceBase;
import quanta.exception.ForbiddenException;
import quanta.exception.NoAgentException;
import quanta.exception.base.RuntimeEx;
import quanta.model.AIResponse;
import quanta.model.NodeInfo;
import quanta.model.PropertyInfo;
import quanta.model.client.AIModel;
import quanta.model.client.Constant;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.model.client.SystemConfig;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.CreateNodeLocation;
import quanta.mongo.model.SubNode;
import quanta.rest.request.CreateSubNodeRequest;
import quanta.rest.request.InsertNodeRequest;
import quanta.rest.response.CreateSubNodeResponse;
import quanta.rest.response.InsertNodeResponse;
import quanta.rest.response.base.NodeChanges;
import quanta.service.AclService;
import quanta.types.TypeBase;
import quanta.util.Const;
import quanta.util.Convert;
import quanta.util.TL;
import quanta.util.val.Val;

/**
 * Performs the 'create' (as in CRUD) operations for creating new nodes in MongoDB
 */
@Component
public class MongoCreate extends ServiceBase {
    @SuppressWarnings("unused")
    private static Logger log = LoggerFactory.getLogger(MongoCreate.class);
    // this large top reserve size means the "insert at top" will always be done with out multiple
    // node updates except for once every thousand times.
    private static long RESERVE_BLOCK_SIZE = 1000;

    public SubNode createNode(SubNode parent, String type, Class<? extends SubNode> nodeClass, Long ordinal,
            CreateNodeLocation location, boolean updateParentOrdinals, NodeChanges nodeChanges) {
        return createNode(parent, null, type, nodeClass, ordinal, location, null, null, updateParentOrdinals, true,
                nodeChanges);
    }

    public SubNode createNode(String path) {
        SubNode node = new SubNode(TL.getSC().getUserNodeObjId(), path, NodeType.NONE.s(), null);
        svc_mongoUpdate.updateParentHasChildren(node);
        return node;
    }

    public SubNode createNode(String path, String type, Class<? extends SubNode> nodeClass) {
        if (type == null) {
            type = NodeType.NONE.s();
        }
        // SubNode node = new SubNode(TL.getSC().getUserNodeObjId(), path, type, null);
        SubNode node = nodeClass == null ? new SubNode(TL.getSC().getUserNodeObjId(), path, type, null)
                : createNode(nodeClass, TL.getSC().getUserNodeObjId(), path, type, null);
        svc_mongoUpdate.updateParentHasChildren(node);
        return node;
    }

    /*
     * Creates a node, but does NOT persist it. If parent==null it assumes it's adding a root node. This
     * is required, because all the nodes at the root level have no parent. That is, there is no ROOT
     * node. Only nodes considered to be on the root.
     *
     * relPath can be null if no path is known
     */
    public SubNode createNode(SubNode parent, String relPath, String type, Class<? extends SubNode> nodeClass,
            Long ordinal, CreateNodeLocation location, List<PropertyInfo> properties, ObjectId ownerId,
            boolean updateOrdinals, boolean updateParent, NodeChanges nodeChanges) {
        if (relPath == null) {
            // Adding a node ending in '?' will trigger for the system to generate a leaf node automatically.
            relPath = "?";
        }
        if (type == null) {
            type = NodeType.NONE.s();
        }
        String path = (parent == null ? "" : parent.getPath()) + "/" + relPath;
        if (ownerId == null) {
            ownerId = TL.getSC().getUserNodeObjId();
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
                ordinal = (Long) svc_arun.run(() -> {
                    return svc_mongoCreate.prepOrdinalForLocation(location, parent, _ordinal, nodeChanges);
                });
            }
        }

        // SubNode node = new SubNode(ownerId, path, type, ordinal);
        SubNode node = nodeClass == null ? new SubNode(ownerId, path, type, ordinal)
                : createNode(nodeClass, ownerId, path, type, ordinal);
        if (updateParent && parent != null) {
            parent.setHasChildren(true);
            svc_mongoUpdate.saveSession(false);
        }

        if (properties != null) {
            for (PropertyInfo propInfo : properties) {
                node.set(propInfo.getName(), propInfo.getValue());
            }
        }
        return node;
    }

    // Factory method for creating instances with parameterized constructor
    public static <T extends SubNode> T createNode(Class<T> nodeClass, ObjectId owner, String path, String type,
            Long ordinal) {
        try {
            Constructor<T> constructor =
                    nodeClass.getConstructor(ObjectId.class, String.class, String.class, Long.class);
            return constructor.newInstance(owner, path, type, ordinal);
        } catch (Exception e) {
            throw new RuntimeEx("Failed to create node instance", e);
        }
    }

    private Long prepOrdinalForLocation(CreateNodeLocation location, SubNode parent, Long ordinal,
            NodeChanges nodeChanges) {
        switch (location) {
            case FIRST:
                ordinal = svc_mongoCreate.insertOrdinal(parent, 0L, 1L, nodeChanges);
                break;
            case LAST:
                ordinal = svc_mongoRead.getMaxChildOrdinal(parent) + 1;
                break;
            case ORDINAL:
                ordinal = svc_mongoCreate.insertOrdinal(parent, ordinal, 1L, nodeChanges);
                break;
            default:
                throw new RuntimeEx("Unknown ordinal");
        }
        svc_mongoUpdate.saveSession(false);
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
    public long insertOrdinal(SubNode node, long ordinal, long rangeSize, NodeChanges nodeChanges) {
        long minOrdinal = svc_mongoRead.getMinChildOrdinal(node);
        // default new ordinal to ordinal
        long newOrdinal = ordinal;
        /*
         * We detect the special case where we're attempting to insert at 'top' ordinals and if we find room
         * to grab an ordinal at minOrdinal-1 then we do so. Whenever Quanta renumbers nodes it tries to
         * leave RESERVE_BLOCK_SIZE at the head so that inserts "at top" will alway some in as 999, 998,
         * 997, etc, until it's forced to renumber, when the top node happens to have zero ordinal and we
         * end up trying to insert above it. if we're inserting a single node
         */
        if (rangeSize == 1) {
            // if the target ordinal is at or below the current minimum
            if (ordinal <= minOrdinal) {
                // if we have space below the current minimum we can just use it
                if (minOrdinal > 0) {
                    long ret = minOrdinal - 1;
                    // always grab the index at halfway to zero so we can leave room for for future inserts to
                    // get lucky and have a place to land without causing a multi-node renumbering.
                    if (ret > 0) {
                        ret = ret / 2;
                    }
                    return ret;
                }
                // "INSERT_BLOCK_SIZE - 1" be the topmost ordinal now // else minOrdinal is already at zero so
                // we insert a new block, and then let
                else {
                    rangeSize = RESERVE_BLOCK_SIZE;
                    newOrdinal = RESERVE_BLOCK_SIZE - 1;
                }
            }
        }
        svc_auth.readAuth(node);
        // save all if there's any to save.
        svc_mongoUpdate.saveSession(false);
        Criteria crit = Criteria.where(SubNode.ORDINAL).gte(ordinal);
        BulkOperations bops = null;
        int batchSize = 0;

        boolean madeNodeChanges = false;
        for (SubNode child : svc_mongoRead.getChildrenAP(node, Sort.by(Sort.Direction.ASC, SubNode.ORDINAL), null, 0,
                crit)) {
            // lazy create bulkOps
            if (bops == null) {
                bops = svc_ops.bulkOps(BulkMode.UNORDERED);
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
    public CreateSubNodeResponse cm_createSubNode(CreateSubNodeRequest req) {
        CreateSubNodeResponse res = new CreateSubNodeResponse();
        NodeChanges nodeChanges = new NodeChanges();
        res.setNodeChanges(nodeChanges);
        boolean linkBookmark = "linkBookmark".equals(req.getPayloadType());
        String nodeId = req.getNodeId();
        boolean makePublicWritable = false;
        boolean allowSharing = true;
        boolean forceInheritSharing = false;

        // note: parentNode and nodeBeingReplied to are not necessarily the same. 'parentNode' is the node
        // that will HOLD the reply, but may not always be WHAT is being replied to.
        SubNode parentNode = null;
        SubNode nodeBeingRepliedTo = null;

        /*
         * If this is a "New Post" from the Feed tab we get here with no ID but we put this in user's
         * "My Posts" node, and the other case is if we are doing a reply we also will put the reply in the
         * user's POSTS node.
         */
        if (nodeId == null && !linkBookmark) {
            parentNode = svc_mongoRead.getUserNodeByType(null, null, "### Posts", NodeType.POSTS.s(),
                    Arrays.asList(PrivilegeType.READ.s()), true);

            if (parentNode != null) {
                nodeId = parentNode.getIdStr();
                makePublicWritable = true;
            }
        }

        // Node still null, then try other ways of getting it
        if (parentNode == null) {
            if (linkBookmark) {
                parentNode = svc_mongoRead.getUserNodeByType(TL.getSC().getUserName(), null, "### Bookmarks",
                        NodeType.BOOKMARK_LIST.s(), null, false);
            } //
            else if (nodeId != null && nodeId.equals("~" + NodeType.NOTES.s())) {
                parentNode = svc_mongoRead.getUserNodeByType(TL.getSC().getUserName(), null, "### Notes",
                        NodeType.NOTES.s(), null, false);
            } else {
                parentNode = svc_mongoRead.getNode(nodeId);
            }
        }

        // lets the type override the location where the node is created.
        TypeBase plugin = svc_typeMgr.getPluginByType(req.getTypeName());
        TypeBase parentPlugin = svc_typeMgr.getPluginByType(parentNode.getType());
        if (plugin != null) {
            Val<SubNode> vcNode = new Val<>(parentNode);
            Val<String> vcContent = new Val<>(req.getContent());
            plugin.preCreateNode(vcNode, vcContent, linkBookmark);
            req.setContent(vcContent.getVal());
            parentNode = vcNode.getVal();
        }

        if (parentNode == null) {
            throw new RuntimeEx("unable to locate parent for insert");
        }

        // if user is adding a node under one of their parent nodes then we inherit the sharing
        if (parentNode.getOwner().equals(TL.getSC().getUserNodeObjId())) {
            forceInheritSharing = true;
        }

        String typeToCreate = req.getTypeName();
        AIResponse aiResponse = null;
        AIModel svc = null;

        if (NodeType.NONE.s().equals(parentNode.getType())) {
            if (req.isAiRequest()) {
                // First scan up the tree to see if we have a svc on the tree and if so use it instead.
                SystemConfig system = new SystemConfig();
                svc_aiUtil.getAIConfigFromAncestorNodes(parentNode, system);
                if (system.getService() != null) {
                    svc = AIModel.fromString(system.getService());
                }
                if (svc == null) {
                    throw new NoAgentException();
                }
                aiResponse = svc_ai.getAnswer(Constant.AI_MODE_AGENT.s().equals(req.getAiMode()), parentNode, null,
                        system, svc);

                typeToCreate = NodeType.AI_ANSWER.s();
            }
        }

        svc_auth.writeAuth(parentNode);

        // note: redundant security
        if (svc_acl.isAdminOwned(parentNode) && !TL.hasAdminPrivileges()) {
            throw new ForbiddenException();
        }

        boolean aiOverwrite = parentNode.hasProp(NodeProp.AI_QUERY_TEMPLATE.s()) && req.isAllowAiOverwrite();
        SubNode newNode = null;
        if (!aiOverwrite) {
            CreateNodeLocation createLoc = req.isCreateAtTop() ? CreateNodeLocation.FIRST : CreateNodeLocation.LAST;

            if (svc != null) {
                if (req.getProperties() == null) {
                    req.setProperties(Arrays.asList(new PropertyInfo(NodeProp.AI_SERVICE.s(), svc.s())));
                } else {
                    req.getProperties().add(new PropertyInfo(NodeProp.AI_SERVICE.s(), svc.s()));

                }
            }
            newNode = svc_mongoCreate.createNode(parentNode, null, typeToCreate, null, 0L, createLoc,
                    req.getProperties(), null, true, true, nodeChanges);
            if (req.isPendingEdit()) {
                newNode.setPath(svc_mongoUtil.setPendingPathState(newNode.getPath(), true));
            }

            if (aiResponse != null) {
                newNode.setContent(aiResponse.getContent());
            } else if (req.getContent() != null) {
                newNode.setContent(req.getContent());
            }
            newNode.touch();
        }
        // if this AI question is set to overwrite the parent's content do that and then return, we're done.
        else {
            if (aiResponse != null) {
                parentNode.setContent(aiResponse.getContent());
            }
            parentNode.touch();
            svc_mongoUpdate.save(parentNode);
            NodeInfo nodeInfo = svc_convert.toNodeInfo(false, TL.getSC(), parentNode, false,
                    Convert.LOGICAL_ORDINAL_GENERATE, true, false, false, true, null);
            res.setNewNode(nodeInfo);
            return res;
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

        if (allowSharing && aiResponse == null) {
            // if a user to share to (a Direct Message) is provided, add it.
            if (req.getShareToUserId() != null) {
                HashMap<String, AccessControl> ac = new HashMap<>();
                ac.put(req.getShareToUserId(), new AccessControl(null, Const.RDWR));
                newNode.setAc(ac);
            }
            // isReply really also can mean !parentNode.isMine for current user
            else if (!svc_acl.userOwnsNode(parentNode) || forceInheritSharing) {
                svc_acl.inheritSharingFromParent(res, nodeBeingRepliedTo, newNode);
            }

            // Always make public if we're replying to public node or posting under our POSTs node
            if ((makePublicWritable || AclService.isPublic(nodeBeingRepliedTo)) || parentNode.isType(NodeType.POSTS)) {
                svc_acl.addPrivilege(null, newNode, PrincipalName.PUBLIC.s(), null,
                        Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
            }
        }
        svc_openGraph.parseNode(newNode, true);

        if (parentPlugin != null) {
            parentPlugin.childCreated(new Val<>(parentNode), new Val<>(newNode));
        }
        setDefaultTags(parentNode, newNode);
        if (Constant.AI_MODE_WRITING.s().equals(req.getAiMode())) {
            newNode.set(NodeProp.AI_QUERY_TEMPLATE, "");
        }
        svc_mongoUpdate.save(newNode);

        res.setNewNode(svc_convert.toNodeInfo(false, TL.getSC(), newNode, false, //
                req.isCreateAtTop() ? 0 : Convert.LOGICAL_ORDINAL_GENERATE, false, false, false, false, null));

        return res;
    }

    private void setDefaultTags(SubNode parentNode, SubNode newNode) {
        if (parentNode.getTags() != null) {
            if (parentNode.getTags().contains("#book")) {
                newNode.setTags("#chapter");
            } else if (parentNode.getTags().contains("#chapter")) {
                newNode.setTags("#section");
            } else if (parentNode.getTags().contains("#section")) {
                newNode.setTags("#subsection");
            }
        }
    }

    /*
     * Creates a new node that is a sibling (same parent) of and at the same ordinal position as the
     * node specified in the request. Should ONLY be called by the controller that accepts a node being
     * created by the GUI/user
     */
    public InsertNodeResponse cm_insertNode(InsertNodeRequest req) {
        InsertNodeResponse res = new InsertNodeResponse();
        NodeChanges changes = new NodeChanges();
        res.setNodeChanges(changes);

        String parentId = req.getParentId();

        /*
         * If no parent specified, then we assume the parent of siblingId is our parent, and get parentId
         * that way.
         */
        if (StringUtils.isEmpty(parentId)) {
            if (StringUtils.isEmpty(req.getSiblingId())) {
                throw new RuntimeEx("No parent or sibling specified for insert");
            }
            SubNode siblingNode = svc_mongoRead.getNode(req.getSiblingId());
            SubNode parentNode = svc_mongoRead.getParent(siblingNode);
            if (parentNode == null) {
                throw new RuntimeEx("Unable to find parent note to insert under: " + parentId);
            }
            parentId = parentNode.getIdStr();
        }

        SubNode parentNode = svc_mongoRead.getNode(parentId);
        if (parentNode == null) {
            throw new RuntimeEx("Unable to find parent note to insert under: " + parentId);
        }
        svc_auth.writeAuth(parentNode);

        // note: redundant security
        if (svc_acl.isAdminOwned(parentNode) && !TL.hasAdminPrivileges()) {
            throw new ForbiddenException();
        }
        SubNode newNode = svc_mongoCreate.createNode(parentNode, null, req.getTypeName(), null, req.getTargetOrdinal(),
                CreateNodeLocation.ORDINAL, null, null, true, true, changes);
        if (req.getInitialValue() != null) {
            newNode.setContent(req.getInitialValue());
        } else {
            newNode.setContent("");
        }
        newNode.touch();
        // pending path (nodes not yet saved by user, being edited/created by users)
        if (req.isPendingEdit()) {
            newNode.setPath(svc_mongoUtil.setPendingPathState(newNode.getPath(), true));
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
                svc_acl.addPrivilege(null, newNode, PrincipalName.PUBLIC.s(), null,
                        Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), null);
            } else {
                svc_acl.inheritSharingFromParent(res, parentNode, newNode);
            }
        }

        // createNode might have altered 'hasChildren', so we save if dirty
        svc_mongoUpdate.saveIfDirty(parentNode);
        // We save this right away, before calling convertToNodeInfo in case that method does any Db related
        // stuff where it's expecting the node to exist.
        svc_openGraph.parseNode(newNode, true);

        TypeBase plugin = svc_typeMgr.getPluginByType(req.getTypeName());
        if (plugin != null) {
            Val<SubNode> vcNode = new Val<>(parentNode);
            plugin.preCreateNode(vcNode, null, false);
            parentNode = vcNode.getVal();
        }
        TypeBase parentPlugin = svc_typeMgr.getPluginByType(parentNode.getType());

        if (parentPlugin != null) {
            parentPlugin.childCreated(new Val<>(parentNode), new Val<>(newNode));
        }

        setDefaultTags(parentNode, newNode);
        if (Constant.AI_MODE_WRITING.s().equals(req.getAiMode())) {
            newNode.set(NodeProp.AI_QUERY_TEMPLATE, "");
        }

        // we save right away here so we get the node ID
        svc_mongoUpdate.save(newNode);

        res.setNewNode(svc_convert.toNodeInfo(false, TL.getSC(), newNode, false, //
                Convert.LOGICAL_ORDINAL_GENERATE, false, false, false, false, null));
        return res;
    }
}
