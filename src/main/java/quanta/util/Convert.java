package quanta.util;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.exception.ForbiddenException;
import quanta.model.AccessControlInfo;
import quanta.model.ImageSize;
import quanta.model.NodeInfo;
import quanta.model.PropertyInfo;
import quanta.model.client.Attachment;
import quanta.model.client.Constant;
import quanta.model.client.ConstantInt;
import quanta.model.client.NodeLink;
import quanta.model.client.NodeProp;
import quanta.model.client.PrincipalName;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;
import quanta.types.TypeBase;

/**
 * Converting objects from one type to another, and formatting.
 */
@Component
public class Convert extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(Convert.class);

    public static int LOGICAL_ORDINAL_IGNORE = -1;
    // indicates we need generate the correct logicalOrdinal
    public static int LOGICAL_ORDINAL_GENERATE = -2;

    /*
     * Generates a NodeInfo object, which is the primary data type that is also used on the
     * browser/client to encapsulate the data for a given node which is used by the browser to render
     * the node.
     */
    public NodeInfo toNodeInfo(boolean adminOnly, SessionContext sc, SubNode node, boolean initNodeEdit,
            long logicalOrdinal, boolean allowInlineChildren, boolean lastChild, boolean getFollowers,
            boolean loadLikes, HashMap<String, SubNode> nodeMap) {
        String sig = node.getStr(NodeProp.CRYPTO_SIG);

        // if we have a signature, check it.
        boolean sigFail = false;
        if (sig != null && !svc_crypto.nodeSigVerify(node, sig, nodeMap)) {
            sigFail = true;
        }

        // #sig: need a config setting that specifies which path(s) are required to be signed so
        // this can be enabled/disabled easily by admin
        if (svc_prop.isRequireCrypto() && node.getPath().startsWith(NodePath.PUBLIC_PATH + "/") && //
                (sig == null || sigFail) && !TL.hasAdminPrivileges()) {
            /*
             * Note: This is designed to silently fail here and not show the nodes where a signature is failing
             * and a possible database hack, however on a clean install when an anon user visits the site and
             * the 'home' node is not yet signed we get this error with no explaination of why.
             */
            // This will cause an email to be sent to admin as well as show up in the Server Info panel
            svc_crypto.getFailedSigNodes().add(node.getIdStr());

            log.error("Bad Sig on Node: " + node.getIdStr());
            /*
             * if we're under the PUBLIC_PATH and a signature fails, don't even show the node if this is an
             * ordinary user, because this means an 'admin' node is failing it's signature, and is an indication
             * of a server DB being potentially hacked so we completely refuse to display this content to the
             * user by returning null here. We only show 'signed' admin nodes to users. If we're logged in as
             * admin we will be allowed to see even nodes that are failing their signature check, or unsigned.
             */
            return null;
        }

        // if we know we should only be including admin node then throw an error if this is not an admin
        // node, but only if we ourselves are not admin.
        if (adminOnly && !svc_acl.isAdminOwned(node) && !TL.hasAdminPrivileges()) {
            throw new ForbiddenException();
        }

        boolean hasChildren = svc_mongoRead.hasChildren(node);
        List<PropertyInfo> propList = buildPropertyInfoList(sc, node, initNodeEdit, sigFail);
        List<AccessControlInfo> acList = svc_acl.buildAccessControlList(sc, node);
        if (node.getOwner() == null) {
            throw new RuntimeException("node has no owner: " + node.getIdStr() + " node.path=" + node.getPath());
        }
        String ownerId = node.getOwner().toHexString();
        String avatarVer = null;
        String nameProp = null;
        String displayName = null;
        String owner = PrincipalName.ADMIN.s();
        AccountNode ownerAccnt = svc_user.getAccountNodeAP(node);

        if (ownerAccnt != null) {
            nameProp = ownerAccnt.getStr(NodeProp.USER);
            Attachment userAtt = ownerAccnt.getAttachment(Constant.ATTACHMENT_PRIMARY.s(), false, false);
            if (userAtt != null) {
                avatarVer = userAtt.getBin();
            }
            displayName = svc_user.getFriendlyNameFromNode(ownerAccnt);
            owner = nameProp;
        }

        /*
         * If the node is not owned by the person doing the browsing we need to extract the key from ACL and
         * put in cipherKey, so send back so the user can decrypt the node.
         */
        String cipherKey = null;
        if (!ownerId.equals(sc.getUserNodeId()) && node.getAc() != null) {
            AccessControl ac = node.getAc().get(sc.getUserNodeId());
            if (ac != null) {
                cipherKey = ac.getKey();
                if (cipherKey != null) {
                    log.debug("Rendering Sent Back CipherKey: " + cipherKey);
                }
            }
        }
        ArrayList<String> likes = null;
        if (node.getLikes() != null) {
            likes = new ArrayList<String>(node.getLikes());
        }
        String content = node.getContent();
        String renderContent = null;

        if (logicalOrdinal == LOGICAL_ORDINAL_GENERATE) {
            logicalOrdinal = svc_mongoRead.generateLogicalOrdinal(node);
        }

        NodeInfo nodeInfo = new NodeInfo(node.jsonId(), node.getPath(), node.getName(), content, renderContent, //
                node.getTags(), displayName, //
                owner, ownerId, node.getTransferFrom() != null ? node.getTransferFrom().toHexString() : null, //
                node.getOrdinal(), //
                node.getModifyTime(), //
                propList, node.getAttachments(), node.getLinks(), acList, likes, hasChildren, node.getType(), //
                logicalOrdinal, lastChild, cipherKey, avatarVer);

        if (TL.getSC().isAnon()
                || (TL.getSC().getUserNodeObjId() != null && !TL.getSC().getUserNodeObjId().equals(node.getOwner()))) {
            if (!TL.hasAdminPrivileges()) {
                clearSecretProperties(nodeInfo);
            }
        }

        // if this node type has a plugin run it's converter to let it contribute
        TypeBase plugin = svc_typeMgr.getPluginByType(node.getType());
        if (plugin != null) {
            plugin.convert(nodeInfo, node, ownerAccnt, getFollowers);
        }

        // allow client to know if this node is not yet saved by user
        if (node.getPath().startsWith(NodePath.PENDING_PATH_S)) {
            nodeInfo.safeGetClientProps().add(new PropertyInfo(NodeProp.IN_PENDING_PATH.s(), "1"));
        }

        if (allowInlineChildren) {
            processInlineChildren(sc, node, initNodeEdit, allowInlineChildren, lastChild, loadLikes, nodeInfo);
        }

        if (node.getLinks() != null) {
            LinkedList<NodeInfo> linkedNodes = new LinkedList<>();
            nodeInfo.setLinkedNodes(linkedNodes);
            for (NodeLink link : node.getLinks()) {
                SubNode linkNode = svc_mongoRead.getNode(link.getNodeId());
                if (linkNode != null) {
                    NodeInfo info = toNodeInfo(false, sc, linkNode, false, Convert.LOGICAL_ORDINAL_IGNORE, false, false,
                            false, true, null);
                    if (info != null) {
                        linkedNodes.add(info);
                    }
                }
            }
        }
        return nodeInfo;
    }

    private void clearSecretProperties(NodeInfo info) {
        List<PropertyInfo> props = info.getProperties();
        if (props == null)
            return;

        svc_snUtil.removeProp(props, NodeProp.EMAIL.s());
        svc_snUtil.removeProp(props, NodeProp.CODE.s());
        svc_snUtil.removeProp(props, NodeProp.ENC_KEY.s());
        svc_snUtil.removeProp(props, NodeProp.PWD_HASH.s());
        svc_snUtil.removeProp(props, NodeProp.VOTE.s());
    }

    private void processInlineChildren(SessionContext sc, SubNode node, boolean initNodeEdit,
            boolean allowInlineChildren, boolean lastChild, boolean loadLikes, NodeInfo nodeInfo) {
        boolean hasInlineChildren = false;

        // first check if user has controlled expansion by a click yet
        if (sc.getNodeExpandStates().containsKey(node.getIdStr())) {
            hasInlineChildren = sc.getNodeExpandStates().get(node.getIdStr());
            nodeInfo.safeGetClientProps()
                    .add(new PropertyInfo(NodeProp.EXPANSION_BY_USER.s(), hasInlineChildren ? "1" : "0"));
        }
        // if user is not controlling expansion get state from node itself as set by owner of the node.
        else {
            hasInlineChildren = node.getBool(NodeProp.INLINE_CHILDREN);
        }

        if (hasInlineChildren) {
            Iterable<SubNode> nodeIter = svc_mongoRead.getChildren(node, Sort.by(Sort.Direction.ASC, SubNode.ORDINAL),
                    ConstantInt.MAX_EXPANDED_CHILDREN.val(), 0);
            Iterator<SubNode> iterator = nodeIter.iterator();
            long inlineOrdinal = 0;

            while (true) {
                if (!iterator.hasNext()) {
                    break;
                }
                SubNode n = iterator.next();
                NodeInfo info = toNodeInfo(false, sc, n, initNodeEdit, inlineOrdinal++, allowInlineChildren, lastChild,
                        false, loadLikes, null);
                if (info != null) {
                    nodeInfo.safeGetChildren().add(info);
                }
            }
        }
    }

    public static ImageSize getImageSize(Attachment att) {
        ImageSize imageSize = new ImageSize();
        if (att != null) {
            try {
                Integer width = att.getWidth();
                if (width != null) {
                    imageSize.setWidth(width.intValue());
                }
                Integer height = att.getHeight();
                if (height != null) {
                    imageSize.setHeight(height.intValue());
                }
            } catch (Exception e) {
                imageSize.setWidth(0);
                imageSize.setHeight(0);
            }
        }
        return imageSize;
    }

    public List<PropertyInfo> buildPropertyInfoList(SessionContext sc, SubNode node, //
            boolean initNodeEdit, boolean sigFail) {
        List<PropertyInfo> props = null;
        HashMap<String, Object> propMap = node.getProps();
        if (propMap != null && propMap.keySet() != null) {
            for (String propName : propMap.keySet()) {
                // indicate to the client the signature is no good by not even sending the bad signature to client.
                if (sigFail && NodeProp.CRYPTO_SIG.s().equals(propName)) {
                    continue;
                }
                // lazy create props
                if (props == null) {
                    props = new LinkedList<>();
                }
                PropertyInfo propInfo = toPropInfo(sc, node, propName, propMap.get(propName), initNodeEdit);
                props.add(propInfo);
            }
        }
        if (props != null) {
            props.sort((a, b) -> a.getName().compareTo(b.getName()));
        }
        return props;
    }

    public PropertyInfo toPropInfo(SessionContext sc, SubNode node, String propName, Object prop,
            boolean initNodeEdit) {
        try {
            Object value = null;
            if (prop instanceof Date o) {
                value = DateUtil.formatTimeForUserTimezone(o, sc.getTimezone(), sc.getTimeZoneAbbrev());
            } //
            else if (prop instanceof Collection) {
                value = prop;
            } else {
                value = prop.toString();
            }
            // log.trace(String.format("prop[%s]=%s", prop.getName(), value));
            PropertyInfo propInfo = new PropertyInfo(propName, value);
            return propInfo;
        } catch (Exception ex) {
            throw ExUtil.wrapEx(ex);
        }
    }

    public String basicTextFormatting(String val) {
        val = val.replace("\n\r", "<p>");
        val = val.replace("\n", "<p>");
        val = val.replace("\r", "<p>");
        return val;
    }
}
