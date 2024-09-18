package quanta.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.StringTokenizer;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Component;
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
import quanta.mongo.MongoTranMgr;
import quanta.mongo.model.CreateNodeLocation;
import quanta.mongo.model.SubNode;
import quanta.rest.request.GetNodeJsonRequest;
import quanta.rest.request.InitNodeEditRequest;
import quanta.rest.request.LikeNodeRequest;
import quanta.rest.request.LinkNodesRequest;
import quanta.rest.request.SaveNodeJsonRequest;
import quanta.rest.request.SaveNodeRequest;
import quanta.rest.request.SearchAndReplaceRequest;
import quanta.rest.request.SetExpandedRequest;
import quanta.rest.request.SplitNodeRequest;
import quanta.rest.response.GetNodeJsonResponse;
import quanta.rest.response.InitNodeEditResponse;
import quanta.rest.response.LikeNodeResponse;
import quanta.rest.response.LinkNodesResponse;
import quanta.rest.response.SaveNodeJsonResponse;
import quanta.rest.response.SaveNodeResponse;
import quanta.rest.response.SearchAndReplaceResponse;
import quanta.rest.response.SetExpandedResponse;
import quanta.rest.response.SplitNodeResponse;
import quanta.rest.response.UpdateHeadingsResponse;
import quanta.rest.response.base.NodeChanges;
import quanta.types.TypeBase;
import quanta.util.Convert;
import quanta.util.SubNodeUtil;
import quanta.util.TL;
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

    public LikeNodeResponse likeNode(LikeNodeRequest req) {
        MongoTranMgr.ensureTran();
        LikeNodeResponse res = new LikeNodeResponse();
        svc_async.run(() -> {
            svc_arun.run(() -> {
                SubNode node = svc_mongoRead.getNode(req.getId());
                if (node == null) {
                    throw new RuntimeEx("Unable to find node: " + req.getId());
                }
                if (node.getLikes() == null) {
                    node.setLikes(new HashSet<>());
                }
                String userName = TL.getSC().getUserName();
                // local users will always just have their userName put in the 'likes'
                if (req.isLike()) {
                    if (node.getLikes().add(userName)) {
                        // set node to dirty only if it just changed.
                        TL.dirty(node);
                    }
                } else {
                    if (node.getLikes().remove(userName)) {
                        // set node to dirty only if it just changed.
                        TL.dirty(node);
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

    public SaveNodeResponse saveNode(SaveNodeRequest req) {
        SaveNodeResponse res = new SaveNodeResponse();
        NodeInfo nodeInfo = req.getNode();
        String nodeId = nodeInfo.getId();
        SubNode node = svc_mongoRead.getNode(nodeId);
        svc_auth.ownerAuth(node);
        svc_mongoRead.forceCheckHasChildren(node);

        // set new attachments
        node.setAttachments(req.getNode().getAttachments());

        svc_attach.fixAllAttachmentMimes(node);
        node.setLinks(req.getNode().getLinks());
        // The only purpose of this limit is to stop hackers from using up lots of space, because our only
        // current quota is on attachment file size uploads
        if (nodeInfo.getContent() != null && nodeInfo.getContent().length() > 64 * 1024) {
            throw new RuntimeEx("Max text length is 64K");
        }
        // If current content exists content is being edited reset likes
        if (node.getContent() != null && node.getContent().trim().length() > 0
                && !Util.equalObjs(node.getContent(), nodeInfo.getContent())) {
            node.setLikes(null);
        }
        node.setContent(nodeInfo.getContent());
        node.setTags(nodeInfo.getTags());
        node.touch();
        node.setType(nodeInfo.getType());

        // if node name is empty or not valid (canot have ":" in the name) set it to null quietly
        if (StringUtils.isEmpty(nodeInfo.getName())) {
            node.setName(null);
        } //
        else if (nodeInfo.getName() != null && nodeInfo.getName().length() > 0
                && !nodeInfo.getName().equals(node.getName())) { // if we're setting node name to a different node name
            if (!svc_snUtil.validNodeName(nodeInfo.getName())) {
                throw new RuntimeEx(
                        "Node names can only contain letter, digit, underscore, dash, and period characters.");
            }
            String nodeName = nodeInfo.getName().trim();
            // if not admin we have to lookup the node with "userName:nodeName" format
            if (!TL.hasAdminPrivileges()) {
                nodeName = TL.getSC().getUserName() + ":" + nodeName;
            }
            SubNode nodeByName = svc_mongoRead.getNodeByName(nodeName);
            // delete if orphan (but be safe and double check we aren't deleting `nodeId` node)
            if (nodeByName != null && !nodeId.equals(nodeByName.getIdStr())
                    && svc_mongoRead.isOrphan(nodeByName.getPath())) {
                // if we don't be sure to delete this orphan we might end up with a constraint violation
                // on the node name unique index.
                svc_mongoDelete.directDelete(nodeByName);
                nodeByName = null;
            }
            if (nodeByName != null) {
                throw new RuntimeEx("Node name is already in use. Duplicates not allowed.");
            }
            if (nodeInfo.getName() != null && nodeInfo.getName().length() > 0) {
                node.setName(nodeInfo.getName().trim());
            }
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
                    if (TL.hasAdminPrivileges() || SubNodeUtil.isReadonlyProp(property.getName())) {
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
            svc_mongoUtil.removeAllEncryptionKeys(node);
        } else /* if node is currently encrypted */ {
            res.setAclEntries(svc_auth.getAclEntries(node));
        }

        // If the node being saved is currently in the pending area /p/ then we publish it now, and move
        // it out of pending.
        boolean reSigning = false;
        String newPath = svc_mongoUtil.setPendingPathState(node.getPath(), false);

        // Is this a changed path?
        if (!node.getPath().equals(newPath)) {
            node.setPath(newPath);
            /*
             * If we had a signature on this node, and we know the path has just changed as a result of moving
             * from 'pending path' to real path then we set the signature to TBD and the client will detect this
             * and initiate a reSign of the node.
             */
            if (node.hasProp(NodeProp.CRYPTO_SIG.s())) {
                node.set(NodeProp.CRYPTO_SIG.s(), Constant.SIG_TBD.s());
                reSigning = true;
            }
        } 

        // for now only admin user is REQUIRED to have signed nodes.
        if (!reSigning && svc_prop.isRequireCrypto() && TL.hasAdminPrivileges()) {
            if (!svc_crypto.nodeSigVerify(node, sig)) {
                // stop this node from being saved with 'clean'
                TL.clean(node);
                throw new RuntimeEx("Signature failed.");
            }
        }
        svc_openGraph.parseNode(node, true);

        TypeBase plugin = svc_typeMgr.getPluginByType(node.getType());
        if (plugin != null) {
            plugin.beforeSaveNode(node);
        }
        String sessionUserName = TL.getSC().getUserName();
        SubNode parent = svc_mongoRead.getParentAP(node);
        if (parent != null) {
            parent.setHasChildren(true);
            svc_mongoUpdate.saveIfDirtyAP(parent);
        }
        // Send notification to local server or to remote server when a node is added (and not by admin)
        if (!PrincipalName.ADMIN.s().equals(sessionUserName)) {
            processAfterSave(node, parent);
        }

        NodeInfo newNodeInfo = svc_convert.toNodeInfo(false, TL.getSC(), node, false, Convert.LOGICAL_ORDINAL_GENERATE,
                req.isReturnInlineChildren(), false, false, true, null);
        if (newNodeInfo != null) {
            res.setNode(newNodeInfo);
        }

        // this should be unnessary, but we do it anyway just to be safe
        svc_mongoUpdate.saveSession();
        return res;
    }

    public SetExpandedResponse cm_toggleExpanded(SetExpandedRequest req) {
        SetExpandedResponse res = new SetExpandedResponse();
        SubNode node = svc_mongoRead.getNode(req.getNodeId());

        // get default expanded state from node itself
        boolean expanded = node.getBool(NodeProp.INLINE_CHILDREN);
        SessionContext sc = TL.getSC();

        // if user has already taken control of state, toggle it according to their state
        if (sc.getNodeExpandStates().containsKey(req.getNodeId())) {
            expanded = !sc.getNodeExpandStates().get(req.getNodeId());
        }
        // otherwise the 'expanded' var is the thing to toggle
        else {
            expanded = !expanded;
        }
        sc.getNodeExpandStates().put(req.getNodeId(), expanded);
        svc_mongoRead.forceCheckHasChildren(node);

        NodeInfo newNodeInfo = svc_convert.toNodeInfo(false, TL.getSC(), node, false, Convert.LOGICAL_ORDINAL_GENERATE,
                expanded, false, false, true, null);
        if (newNodeInfo != null) {
            res.setNode(newNodeInfo);
        }
        return res;
    }

    // 'parent' (of 'node') can be passed in if already known, or else null can be passed for
    // parent and we get the parent automatically in here
    public void processAfterSave(SubNode node, SubNode parent) {
        // never do any of this logic if this is an admin-owned node being saved.
        if (svc_acl.isAdminOwned(node)) {
            return;
        }
        svc_arun.run(() -> {
            HashSet<String> sessionsPushed = new HashSet<>();
            if (node.isType(NodeType.FRIEND)) {
                TL.getSC().setFriendsTagsDirty(true);
            }

            svc_push.pushNodeUpdateToBrowsers(sessionsPushed, node);
            return null;
        });
    }

    public SplitNodeResponse splitNode(SplitNodeRequest req) {
        HashSet<String> nodesModified = new HashSet<String>();
        SplitNodeResponse ret = svc_mongoTrans.cm_splitNode(req, nodesModified);

        if (nodesModified.size() > 0) {
            svc_crypto.signNodesById(new ArrayList<String>(nodesModified));
        }
        return ret;
    }

    /*
     * When user pastes in a large amount of text and wants to have this text broken out into individual
     * nodes they can pass into here and double spaces become splitpoints, and this splitNode method
     * will break it all up into individual nodes.
     *
     * req.splitType == 'inline' || 'children'
     */
    public SplitNodeResponse splitNode(SplitNodeRequest req, HashSet<String> nodesModified) {
        MongoTranMgr.ensureTran();
        SplitNodeResponse res = new SplitNodeResponse();
        NodeChanges nodeChanges = new NodeChanges();
        res.setNodeChanges(nodeChanges);
        String nodeId = req.getNodeId();
        SubNode node = svc_mongoRead.getNode(nodeId);
        SubNode parentNode = svc_mongoRead.getParent(node);
        svc_auth.ownerAuth(node);
        String content = node.getContent();
        boolean containsDelim = content.contains(req.getDelimiter());

        // If split will have no effect, just return as if successful.
        if (!containsDelim) {
            return res;
        }

        String[] contentParts = StringUtils.splitByWholeSeparator(content, req.getDelimiter());
        SubNode parentForNewNodes = null;
        long firstOrdinal = 0;

        // When inserting inline all nodes go in right where the original node is, in order below it as
        // siblings
        if (req.getSplitType().equalsIgnoreCase("inline")) {
            parentForNewNodes = parentNode;
            firstOrdinal = node.getOrdinal();
        }
        // but for a 'child' insert all new nodes are inserted as children of the original node, starting
        // at the top (ordinal), regardless of whether this node already has any children or not.
        else {
            parentForNewNodes = node;
            firstOrdinal = 0L;
        }

        int numNewSlots = contentParts.length - 1;
        if (numNewSlots > 0) {
            firstOrdinal =
                    svc_mongoCreate.insertOrdinal(parentForNewNodes, firstOrdinal, numNewSlots, res.getNodeChanges());
            svc_mongoUpdate.save(parentForNewNodes);
        }
        int idx = 0;

        for (String part : contentParts) {
            part = part.trim();
            if (idx == 0) {
                node.setContent(part);
                if (!nodeId.equals(nodeId)) {
                    node.setOrdinal(firstOrdinal);
                }
                node.touch();
                svc_mongoUpdate.save(node);
                nodesModified.add(node.getIdStr());
            } else {
                // This is not a mistake that we pass null for nodeChagnes here (we already captured the shift above
                // for the node we need to worry about)
                SubNode newNode = svc_mongoCreate.createNode(parentForNewNodes, null, null, firstOrdinal + idx,
                        CreateNodeLocation.ORDINAL, false, null);
                newNode.setContent(part);
                newNode.setAc(node.getAc());
                newNode.touch();
                svc_mongoUpdate.save(newNode);
                nodesModified.add(newNode.getIdStr());
            }

            idx++;
        }
        if (req.getSplitType().equalsIgnoreCase("children")) {
            parentForNewNodes.setHasChildren(true);
            svc_mongoUpdate.saveIfDirtyAP(parentForNewNodes);
        }
        return res;
    }

    public LinkNodesResponse cm_linkNodes(LinkNodesRequest req) {
        LinkNodesResponse res = new LinkNodesResponse();
        SubNode sourceNode = svc_mongoRead.getNode(req.getSourceNodeId());
        if (sourceNode != null) {
            NodeLink link = new NodeLink();
            link.setNodeId(req.getTargetNodeId());
            link.setName(req.getName());
            link.setEmbed(req.getEmbed());
            sourceNode.addLink(link);
        }
        return res;
    }

    /*
     * This makes ALL the headings of all the sibling nodes match the heading level of the req.nodeId
     * passed in.
     */
    public UpdateHeadingsResponse cm_updateHeadings(String nodeId) {
        SubNode node = svc_mongoRead.getNode(nodeId);
        svc_auth.ownerAuth(node);
        String content = node.getContent();
        if (content != null) {
            content = content.trim();
            int baseLevel = XString.getHeadingLevel(content);
            int baseSlashCount = StringUtils.countMatches(node.getPath(), "/");

            for (SubNode n : svc_mongoRead.getSubGraph(node, null, 0, false, null)) {
                int slashCount = StringUtils.countMatches(n.getPath(), "/");
                int level = baseLevel + (slashCount - baseSlashCount);
                if (level > 6)
                    level = 6;
                String c = translateHeadingsForLevel(n.getContent(), level);
                if (c != null && !c.equals(n.getContent())) {
                    n.setContent(c);
                }
                // only cache up to 100 dirty nodes at time time before saving/flushing changes.
                if (TL.getDirtyNodeCount() > 100) {
                    svc_mongoUpdate.saveSession();
                }
            }
        }
        svc_mongoUpdate.saveSession();
        return new UpdateHeadingsResponse();
    }

    public String translateHeadingsForLevel(final String nodeContent, int level) {
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
                    // These strings (pound sign headings) could be generated dynamically, but this switch with them
                    // hardcoded is more performant
                    switch (level) {
                        case 0:
                            /*
                             * NOTE: We never want the root node in the Table of Contents, but we do need it to have a
                             * heading level allowed on it, which would cause the PDF renderer to INCLUDE it in the PDF
                             * but we fix that by setting the ToC options to only include headings starting at heading
                             * level 2 and above.
                             */
                            if (!nodeContent.startsWith("# ")) {
                                ret.append("# " + content);
                                continue;
                            }
                            break;
                        case 1:
                            if (!nodeContent.startsWith("## ")) {
                                ret.append("## " + content);
                                continue;
                            }
                            break;
                        case 2:
                            if (!nodeContent.startsWith("### ")) {
                                ret.append("### " + content);
                                continue;
                            }
                            break;
                        case 3:
                            if (!nodeContent.startsWith("#### ")) {
                                ret.append("#### " + content);
                                continue;
                            }
                            break;
                        case 4:
                            if (!nodeContent.startsWith("##### ")) {
                                ret.append("##### " + content);
                                continue;
                            }
                            break;
                        case 5:
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
     * todo-3: we should be using a bulk update in here and using a streaming resultset instead of
     * holding it all in memory
     */
    public SearchAndReplaceResponse searchAndReplace(SearchAndReplaceRequest req) {
        MongoTranMgr.ensureTran();
        SearchAndReplaceResponse res = new SearchAndReplaceResponse();
        int replacements = 0;
        int cachedChanges = 0;
        String nodeId = req.getNodeId();
        SubNode node = svc_mongoRead.getNode(nodeId);
        svc_auth.ownerAuth(node);
        if (replaceText(node, req.getSearch(), req.getReplace())) {
            replacements++;
            cachedChanges++;
        }

        if (req.isRecursive()) {
            Criteria crit = Criteria.where(SubNode.CONTENT).regex(req.getSearch());
            for (SubNode n : svc_mongoRead.getSubGraph(node, null, 0, false, crit)) {
                if (replaceText(n, req.getSearch(), req.getReplace())) {
                    replacements++;
                    cachedChanges++;
                    // save session immediately every time we get up to 100 pending updates cached.
                    if (cachedChanges >= 100) {
                        cachedChanges = 0;
                        svc_mongoUpdate.saveSession();
                    }
                }
            }
        }
        svc_mongoUpdate.saveSession();
        res.setMessage(String.valueOf(replacements) + " nodes were updated.");
        return res;
    }

    private boolean replaceText(SubNode node, String search, String replace) {
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

    public GetNodeJsonResponse cm_getNodeJson(GetNodeJsonRequest req) {
        GetNodeJsonResponse res = new GetNodeJsonResponse();
        TL.requireAdmin();
        SubNode node = svc_mongoRead.getNodeAP(req.getNodeId());
        if (node != null) {
            res.setJson(XString.prettyPrint(node));
        }
        return res;
    }

    public SaveNodeJsonResponse saveNodeJson(SaveNodeJsonRequest req) {
        MongoTranMgr.ensureTran();
        SaveNodeJsonResponse res = new SaveNodeJsonResponse();
        TL.requireAdmin();

        try {
            SubNode n = Util.simpleMapper.readValue(req.getJson(), SubNode.class);
            svc_arun.run(() -> {
                svc_mongoUpdate.save(n);
                return null;
            });
        } catch (Exception e) {
            throw new RuntimeEx(e);
        }
        return res;
    }

    public InitNodeEditResponse cm_initNodeEdit(InitNodeEditRequest req) {
        InitNodeEditResponse res = new InitNodeEditResponse();
        String nodeId = req.getNodeId();

        // IF EDITING A FRIEND NODE: If 'nodeId' is the Admin-Owned user account node, and this user it
        // wanting to edit his Friend node representing this user.
        if (req.getEditMyFriendNode()) {
            String _nodeId = nodeId;
            nodeId = svc_arun.run(() -> {
                Criteria crit = Criteria.where(SubNode.PROPS + "." + NodeProp.USER_NODE_ID.s()).is(_nodeId);
                // we query as a list, but there should only be ONE result.
                List<SubNode> friendNodes =
                        svc_user.getSpecialNodesList(null, NodeType.FRIEND_LIST.s(), null, false, crit);
                if (friendNodes != null) {
                    for (SubNode friendNode : friendNodes) {
                        return friendNode.getIdStr();
                    }
                }
                return null;
            });
        }
        SubNode node = svc_mongoRead.getNode(nodeId);
        if (node == null) {
            res.error("Node not found.");
            return res;
        }
        svc_auth.ownerAuth(node);

        NodeInfo nodeInfo = svc_convert.toNodeInfo(false, TL.getSC(), node, true, Convert.LOGICAL_ORDINAL_IGNORE, false,
                false, false, false, null);
        res.setNodeInfo(nodeInfo);
        return res;
    }
}
