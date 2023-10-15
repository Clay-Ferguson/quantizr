package quanta.service.node;

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.StringTokenizer;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Component;
import quanta.actpub.model.APList;
import quanta.actpub.model.APObj;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.exception.base.RuntimeEx;
import quanta.model.NodeInfo;
import quanta.model.PropertyInfo;
import quanta.model.client.Constant;
import quanta.model.client.NodeLink;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.mongo.CreateNodeLocation;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.GetNodeJsonRequest;
import quanta.request.InitNodeEditRequest;
import quanta.request.LikeNodeRequest;
import quanta.request.LinkNodesRequest;
import quanta.request.SaveNodeJsonRequest;
import quanta.request.SaveNodeRequest;
import quanta.request.SearchAndReplaceRequest;
import quanta.request.SetExpandedRequest;
import quanta.request.SplitNodeRequest;
import quanta.response.GetNodeJsonResponse;
import quanta.response.InitNodeEditResponse;
import quanta.response.LikeNodeResponse;
import quanta.response.LinkNodesResponse;
import quanta.response.SaveNodeJsonResponse;
import quanta.response.SaveNodeResponse;
import quanta.response.SearchAndReplaceResponse;
import quanta.response.SetExpandedResponse;
import quanta.response.SplitNodeResponse;
import quanta.response.UpdateHeadingsResponse;
import quanta.service.AclService;
import quanta.types.TypeBase;
import quanta.util.Convert;
import quanta.util.SubNodeUtil;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import quanta.util.XString;

/**
 * Service for editing content of nodes. That is, this method updates property values of nodes. As
 * the user is using the application and moving, copy+paste, or editing node content this is the
 * service that performs those operations on the server, directly called from the HTML 'controller'
 */
@Component
public class NodeEditService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(NodeEditService.class);

    public LikeNodeResponse likeNode(MongoSession ms, LikeNodeRequest req) {
        LikeNodeResponse res = new LikeNodeResponse();
        exec.run(() -> {
            arun.run(as -> {
                SubNode node = read.getNode(ms, req.getId());
                if (node == null) {
                    throw new RuntimeException("Unable to find node: " + req.getId());
                }
                if (node.getLikes() == null) {
                    node.setLikes(new HashSet<>());
                }
                String userName = ThreadLocals.getSC().getUserName();
                // String actorUrl = apUtil.makeActorUrlForUserName(userName); // long name not used.
                // local users will always just have their userName put in the 'likes'
                if (req.isLike()) {
                    if (node.getLikes().add(userName)) {
                        // set node to dirty only if it just changed.
                        ThreadLocals.dirty(node);
                        // if this is a foreign post send message out to fediverse
                        if (node.getStr(NodeProp.OBJECT_ID) != null) {
                            apub.sendLikeMessage(as, ms.getUserName(), node);
                        }
                    }
                } else {
                    if (node.getLikes().remove(userName)) {
                        // set node to dirty only if it just changed.
                        ThreadLocals.dirty(node);
                        if (node.getLikes().size() == 0) {
                            node.setLikes(null);
                        }
                    }
                }
                return null;
            });
        });
        return res;
    }

    public SaveNodeResponse saveNode(MongoSession ms, SaveNodeRequest req) {
        SaveNodeResponse res = new SaveNodeResponse();
        NodeInfo nodeInfo = req.getNode();
        String nodeId = nodeInfo.getId();
        SubNode node = read.getNode(ms, nodeId);
        auth.ownerAuth(ms, node);
        read.forceCheckHasChildren(ms, node);
        // remove orphaned attachments
        attach.removeDeletedAttachments(ms, node, req.getNode().getAttachments());
        // set new attachments
        node.setAttachments(req.getNode().getAttachments());
        attach.fixAllAttachmentMimes(node);
        node.setLinks(req.getNode().getLinks());
        /*
         * The only purpose of this limit is to stop hackers from using up lots of space, because our only
         * current quota is on attachment file size uploads
         */
        if (nodeInfo.getContent() != null && nodeInfo.getContent().length() > 64 * 1024) {
            throw new RuntimeEx("Max text length is 64K");
        }
        /* If current content exists content is being edited reset likes */
        if (node.getContent() != null && node.getContent().trim().length() > 0
                && !Util.equalObjs(node.getContent(), nodeInfo.getContent())) {
            node.setLikes(null);
        }
        node.setContent(nodeInfo.getContent());
        node.setTags(nodeInfo.getTags());
        node.touch();
        node.setType(nodeInfo.getType());

        /*
         * if node name is empty or not valid (canot have ":" in the name) set it to null quietly
         */
        if (StringUtils.isEmpty(nodeInfo.getName())) {
            node.setName(null);
        } //
        else if (nodeInfo.getName() != null && nodeInfo.getName().length() > 0
                && !nodeInfo.getName().equals(node.getName())) { // if we're setting node name to a different node name
            if (!snUtil.validNodeName(nodeInfo.getName())) {
                throw new RuntimeEx(
                        "Node names can only contain letter, digit, underscore, dash, and period characters.");
            }
            String nodeName = nodeInfo.getName().trim();
            // if not admin we have to lookup the node with "userName:nodeName" format
            if (!ThreadLocals.getSC().isAdmin()) {
                nodeName = ThreadLocals.getSC().getUserName() + ":" + nodeName;
            }
            SubNode nodeByName = read.getNodeByName(ms, nodeName);
            // delete if orphan (but be safe and double check we aren't deleting `nodeId` node)
            if (nodeByName != null && !nodeId.equals(nodeByName.getIdStr())
                    && read.isOrphan(ms, nodeByName.getPath())) {
                // if we don't be sure to delete this orphan we might end up with a constraint violation
                // on the node name unique index.
                delete.directDelete(nodeByName);
                nodeByName = null;
            }
            if (nodeByName != null) {
                throw new RuntimeEx("Node name is already in use. Duplicates not allowed.");
            }
            node.setName(nodeInfo.getName().trim());
        }

        String sig = null;
        if (nodeInfo.getProperties() != null) {
            for (PropertyInfo property : nodeInfo.getProperties()) {
                if (NodeProp.CRYPTO_SIG.s().equals(property.getName())) {
                    sig = (String) property.getValue();
                }
                if ("[null]".equals(property.getValue())) {
                    node.delete(property.getName());
                } else {
                    /*
                     * save only if server determines the property is savable. Just protection. Client shouldn't be
                     * trying to save stuff that is illegal to save, but we have to assume the worst behavior from
                     * client code, for security and robustness.
                     */
                    if (ms.isAdmin() || SubNodeUtil.isReadonlyProp(property.getName())) {
                        node.set(property.getName(), property.getValue());
                    } else {
                        log.debug("Ignoring save attempt of prop: " + property.getName());
                    }
                }
            }
        }

        // if not encrypted remove ENC_KEY too. It won't be doing anything in this case.
        if (nodeInfo.getContent() != null && !nodeInfo.getContent().startsWith(Constant.ENC_TAG.s())) {
            node.delete(NodeProp.ENC_KEY);
        }
        // If removing encryption, remove it from all the ACL entries too.
        String encKey = node.getStr(NodeProp.ENC_KEY);
        if (encKey == null) {
            mongoUtil.removeAllEncryptionKeys(node);
        } else /* if node is currently encrypted */ {
            res.setAclEntries(auth.getAclEntries(ms, node));
        }
        ipfsPin.pinLocalIpfsAttachments(node);
        /*
         * If the node being saved is currently in the pending area /p/ then we publish it now, and move it
         * out of pending.
         */
        mongoUtil.setPendingPath(node, false);
        // todo-2: for now only admin user is REQUIRED to have signed nodes.
        if (prop.isRequireCrypto() && ms.isAdmin()) {
            if (!crypto.nodeSigVerify(node, sig)) {
                // stop this node from being saved with 'clean'
                ThreadLocals.clean(node);
                throw new RuntimeException("Signature failed.");
            }
        }
        TypeBase plugin = typePluginMgr.getPluginByType(node.getType());
        if (plugin != null) {
            plugin.beforeSaveNode(ms, node);
        }
        String sessionUserName = ThreadLocals.getSC().getUserName();
        SubNode parent = read.getParent(ms, node, false);
        if (parent != null) {
            parent.setHasChildren(true);
        }
        /*
         * Send notification to local server or to remote server when a node is added (and not by admin)
         */
        if (!PrincipalName.ADMIN.s().equals(sessionUserName)) {
            processAfterSave(ms, node, parent);
        }

        NodeInfo newNodeInfo = convert.toNodeInfo(false, ThreadLocals.getSC(), ms, node, false,
                Convert.LOGICAL_ORDINAL_GENERATE, req.isReturnInlineChildren(), false, false, true, true, null, false);
        if (newNodeInfo != null) {
            res.setNode(newNodeInfo);
        }

        return res;
    }

    public SetExpandedResponse toggleExpanded(MongoSession ms, SetExpandedRequest req) {
        SetExpandedResponse res = new SetExpandedResponse();
        SubNode node = read.getNode(ms, req.getNodeId());

        // get default expanded state from node itself
        boolean expanded = node.getBool(NodeProp.INLINE_CHILDREN);
        SessionContext sc = ThreadLocals.getSC();

        // if user has already taken control of state, toggle it according to their state
        if (sc.getNodeExpandStates().containsKey(req.getNodeId())) {
            expanded = !sc.getNodeExpandStates().get(req.getNodeId());
        }
        // otherwise the 'expanded' var is the thing to toggle
        else {
            expanded = !expanded;
        }
        sc.getNodeExpandStates().put(req.getNodeId(), expanded);
        read.forceCheckHasChildren(ms, node);

        NodeInfo newNodeInfo = convert.toNodeInfo(false, ThreadLocals.getSC(), ms, node, false,
                Convert.LOGICAL_ORDINAL_GENERATE, expanded, false, false, true, true, null, false);
        if (newNodeInfo != null) {
            res.setNode(newNodeInfo);
        }
        return res;
    }

    // 'parent' (of 'node') can be passed in if already known, or else null can be passed for
    // parent and we get the parent automatically in here
    public void processAfterSave(MongoSession ms, SubNode node, SubNode parent) {
        // never do any of this logic if this is an admin-owned node being saved.
        if (acl.isAdminOwned(node)) {
            return;
        }
        arun.run(s -> {
            HashSet<String> sessionsPushed = new HashSet<>();
            boolean isAccnt = node.isType(NodeType.ACCOUNT);
            if (node.isType(NodeType.FRIEND)) {
                ThreadLocals.getSC().setFriendsTagsDirty(true);
            }

            push.pushNodeUpdateToBrowsers(s, sessionsPushed, node);

            if (!isAccnt) {
                HashMap<String, APObj> tags = apub.parseTags(node.getContent(), true, true);

                if (tags != null && tags.size() > 0) {
                    String userDoingAction = ThreadLocals.getSC().getUserName();
                    apub.importUsers(ms, tags, userDoingAction);
                    auth.saveMentionsToACL(tags, s, node);
                    node.set(NodeProp.ACT_PUB_TAG, new APList(new LinkedList(tags.values())));
                    update.save(ms, node);
                }
            }

            // if this is an account type then don't expect it to have any ACL but we still want to broadcast
            // out to the world the edit that was made to it, as long as it's not admin owned.
            boolean forceSendToPublic = isAccnt;
            if (forceSendToPublic || node.getAc() != null) {
                // We only send COMMENTS out to ActivityPub servers, and also only if "not unpublished"
                if (!node.getBool(NodeProp.UNPUBLISHED) && node.getType().equals(NodeType.COMMENT.s())) {
                    SubNode _parent = parent;
                    if (_parent == null) {
                        _parent = read.getParent(ms, node, false);
                    }
                    // This broadcasts out to the shared inboxes of all the followers of the user
                    apub.sendObjOutbound(s, _parent, node, forceSendToPublic);
                }
            }
            if (AclService.isPublic(node) && !StringUtils.isEmpty(node.getName())) {
                ipfs.saveNodeToMFS(ms, node);
            }
            return null;
        });
    }

    /*
     * When user pastes in a large amount of text and wants to have this text broken out into individual
     * nodes they can pass into here and double spaces become splitpoints, and this splitNode method
     * will break it all up into individual nodes.
     *
     * req.splitType == 'inline' || 'children'
     */
    public SplitNodeResponse splitNode(MongoSession ms, SplitNodeRequest req) {
        SplitNodeResponse res = new SplitNodeResponse();
        String nodeId = req.getNodeId();
        SubNode node = read.getNode(ms, nodeId);
        SubNode parentNode = read.getParent(ms, node);
        auth.ownerAuth(ms, node);
        String content = node.getContent();
        boolean containsDelim = content.contains(req.getDelimiter());
        /*
         * If split will have no effect, just return as if successful.
         */
        if (!containsDelim) {
            return res;
        }
        String[] contentParts = StringUtils.splitByWholeSeparator(content, req.getDelimiter());
        SubNode parentForNewNodes = null;
        long firstOrdinal = 0;
        /*
         * When inserting inline all nodes go in right where the original node is, in order below it as
         * siblings
         */
        if (req.getSplitType().equalsIgnoreCase("inline")) {
            parentForNewNodes = parentNode;
            firstOrdinal = node.getOrdinal();
        } else /*
                * but for a 'child' insert all new nodes are inserted as children of the original node, starting at
                * the top (ordinal), regardless of whether this node already has any children or not.
                */ {
            parentForNewNodes = node;
            firstOrdinal = 0L;
        }
        int numNewSlots = contentParts.length - 1;
        if (numNewSlots > 0) {
            firstOrdinal = create.insertOrdinal(ms, parentForNewNodes, firstOrdinal, numNewSlots);
            update.save(ms, parentForNewNodes);
        }
        int idx = 0;

        List<String> sigDirtyNodes = new LinkedList<>();

        for (String part : contentParts) {
            // log.debug("ContentPart[" + idx + "] " + part);
            part = part.trim();
            if (idx == 0) {
                node.setContent(part);
                node.setOrdinal(firstOrdinal);
                node.touch();
                update.save(ms, node);
                sigDirtyNodes.add(node.getIdStr());
            } else {
                SubNode newNode = create.createNode(ms, parentForNewNodes, null, firstOrdinal + idx,
                        CreateNodeLocation.ORDINAL, false);
                newNode.setContent(part);
                newNode.setAc(node.getAc());
                newNode.touch();
                update.save(ms, newNode);
                sigDirtyNodes.add(newNode.getIdStr());
            }
            idx++;
        }
        if (req.getSplitType().equalsIgnoreCase("children")) {
            parentForNewNodes.setHasChildren(true);
        }
        crypto.signNodesById(ms, sigDirtyNodes);
        return res;
    }

    public LinkNodesResponse linkNodes(MongoSession ms, LinkNodesRequest req) {
        LinkNodesResponse res = new LinkNodesResponse();
        SubNode sourceNode = read.getNode(ms, req.getSourceNodeId());
        if (sourceNode != null) {
            NodeLink link = new NodeLink();
            link.setNodeId(req.getTargetNodeId());
            link.setName(req.getName());
            sourceNode.addLink(link);
        }
        return res;
    }

    /*
     * This makes ALL the headings of all the sibling nodes match the heading level of the req.nodeId
     * passed in.
     */
    public UpdateHeadingsResponse updateHeadings(MongoSession ms, String nodeId) {
        SubNode node = read.getNode(ms, nodeId, true, null);
        auth.ownerAuth(ms, node);
        String content = node.getContent();
        if (content != null) {
            content = content.trim();
            int baseLevel = XString.getHeadingLevel(content);
            int baseSlashCount = StringUtils.countMatches(node.getPath(), "/");

            for (SubNode n : read.getSubGraph(ms, node, null, 0, false, true, null)) {
                int slashCount = StringUtils.countMatches(n.getPath(), "/");
                int level = baseLevel + (slashCount - baseSlashCount);
                if (level > 6)
                    level = 6;
                String c = translateHeadingsForLevel(ms, n.getContent(), level);
                if (c != null && !c.equals(n.getContent())) {
                    n.setContent(c);
                }
                // only cache up to 100 dirty nodes at time time before saving/flushing changes.
                if (ThreadLocals.getDirtyNodeCount() > 100) {
                    update.saveSession(ms);
                }
            }
        }
        update.saveSession(ms);
        return new UpdateHeadingsResponse();
    }

    public String translateHeadingsForLevel(MongoSession ms, final String nodeContent, int level) {
        if (nodeContent == null)
            return null;
        StringTokenizer t = new StringTokenizer(nodeContent, "\n", true);
        StringBuilder ret = new StringBuilder();

        while (t.hasMoreTokens()) {
            String tok = t.nextToken();
            if (tok.equals("\n")) {
                ret.append("\n");
                continue;
            }
            String content = tok;
            // if this node starts with a heading (hash marks)
            if (content.startsWith("#") && content.indexOf(" ") < 7) {
                int spaceIdx = content.indexOf(" ");
                if (spaceIdx != -1) {
                    // strip the pre-existing hashes off
                    content = content.substring(spaceIdx + 1);
                    /*
                     * These strings (pound sign headings) could be generated dynamically, but this switch with them
                     * hardcoded is more performant
                     */
                    switch (level) {
                        case 0:
                            // this will be the root node (user selected node)
                            break;
                        case 1:
                            if (!nodeContent.startsWith("# ")) {
                                ret.append("# " + content);
                                continue;
                            }
                            break;
                        case 2:
                            if (!nodeContent.startsWith("## ")) {
                                ret.append("## " + content);
                                continue;
                            }
                            break;
                        case 3:
                            if (!nodeContent.startsWith("### ")) {
                                ret.append("### " + content);
                                continue;
                            }
                            break;
                        case 4:
                            if (!nodeContent.startsWith("#### ")) {
                                ret.append("#### " + content);
                                continue;
                            }
                            break;
                        case 5:
                            if (!nodeContent.startsWith("##### ")) {
                                ret.append("##### " + content);
                                continue;
                            }
                            break;
                        case 6:
                            if (!nodeContent.startsWith("###### ")) {
                                ret.append("###### " + content);
                                continue;
                            }
                            break;
                        default:
                            break;
                    }
                }
            }
            ret.append(tok);
        }
        return ret.toString().trim();
    }

    /*
     * todo-2: we should be using a bulk update in here and using a streaming resultset instead of
     * holding it all in memory
     */
    public SearchAndReplaceResponse searchAndReplace(MongoSession ms, SearchAndReplaceRequest req) {
        SearchAndReplaceResponse res = new SearchAndReplaceResponse();
        int replacements = 0;
        int cachedChanges = 0;
        String nodeId = req.getNodeId();
        // log.debug("searchingAndReplace node: " + nodeId);
        SubNode node = read.getNode(ms, nodeId);
        auth.ownerAuth(ms, node);
        if (replaceText(ms, node, req.getSearch(), req.getReplace())) {
            replacements++;
            cachedChanges++;
        }

        if (req.isRecursive()) {
            Criteria crit = Criteria.where(SubNode.CONTENT).regex(req.getSearch());
            for (SubNode n : read.getSubGraph(ms, node, null, 0, false, true, crit)) {
                if (replaceText(ms, n, req.getSearch(), req.getReplace())) {
                    replacements++;
                    cachedChanges++;
                    // save session immediately every time we get up to 100 pending updates cached.
                    if (cachedChanges >= 100) {
                        cachedChanges = 0;
                        update.saveSession(ms);
                    }
                }
            }
        }
        res.setMessage(String.valueOf(replacements) + " nodes were updated.");
        return res;
    }

    private boolean replaceText(MongoSession ms, SubNode node, String search, String replace) {
        String content = node.getContent();
        if (content == null)
            return false;
        if (content.contains(search)) {
            node.setContent(content.replace(search, replace));
            node.touch();
            return true;
        }
        return false;
    }

    public GetNodeJsonResponse getNodeJson(MongoSession ms, GetNodeJsonRequest req) {
        GetNodeJsonResponse res = new GetNodeJsonResponse();
        ThreadLocals.requireAdmin();
        SubNode node = read.getNode(ms, req.getNodeId(), false, null);
        if (node != null) {
            res.setJson(XString.prettyPrint(node));
        }
        return res;
    }

    public SaveNodeJsonResponse saveNodeJson(MongoSession ms, SaveNodeJsonRequest req) {
        SaveNodeJsonResponse res = new SaveNodeJsonResponse();
        ThreadLocals.requireAdmin();

        try {
            SubNode n = Util.simpleMapper.readValue(req.getJson(), SubNode.class);
            update.save(ms, n, false);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return res;
    }

    // todo-1: move to EditNodeService.java
    public InitNodeEditResponse initNodeEdit(MongoSession ms, InitNodeEditRequest req) {
        InitNodeEditResponse res = new InitNodeEditResponse();
        String nodeId = req.getNodeId();
        /*
         * IF EDITING A FRIEND NODE: If 'nodeId' is the Admin-Owned user account node, and this user it
         * wanting to edit his Friend node representing this user.
         */
        if (req.getEditMyFriendNode()) {
            String _nodeId = nodeId;
            nodeId = arun.run(as -> {
                Criteria crit = Criteria.where(SubNode.PROPS + "." + NodeProp.USER_NODE_ID.s()).is(_nodeId);
                // we query as a list, but there should only be ONE result.
                List<SubNode> friendNodes =
                        user.getSpecialNodesList(as, null, NodeType.FRIEND_LIST.s(), null, false, crit);
                if (friendNodes != null) {
                    for (SubNode friendNode : friendNodes) {
                        return friendNode.getIdStr();
                    }
                }
                return null;
            });
        }
        SubNode node = read.getNode(ms, nodeId);
        auth.ownerAuth(ms, node);
        if (node == null) {
            res.error("Node not found.");
            return res;
        }
        NodeInfo nodeInfo = convert.toNodeInfo(false, ThreadLocals.getSC(), ms, node, true,
                Convert.LOGICAL_ORDINAL_IGNORE, false, false, false, false, false, null, false);
        res.setNodeInfo(nodeInfo);
        return res;
    }
}
