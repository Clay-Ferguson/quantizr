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
import quanta.exception.base.RuntimeEx;
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
            boolean loadLikes, HashMap<String, AccountNode> accountNodeMap) {

        // if we know we should only be including admin node then throw an error if this is not an admin
        // node, but only if we ourselves are not admin.
        if (adminOnly && !svc_acl.isAdminOwned(node) && !TL.hasAdminPrivileges()) {
            throw new ForbiddenException();
        }

        boolean hasChildren = svc_mongoRead.hasChildren(node);
        List<PropertyInfo> propList = buildPropertyInfoList(sc, node, initNodeEdit);
        List<AccessControlInfo> acList = svc_acl.buildAccessControlList(sc, node);
        if (node.getOwner() == null) {
            throw new RuntimeEx("node has no owner: " + node.getIdStr() + " node.path=" + node.getPath());
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

    public List<PropertyInfo> buildPropertyInfoList(SessionContext sc, SubNode node, boolean initNodeEdit) {
        List<PropertyInfo> props = null;
        HashMap<String, Object> propMap = node.getProps();
        if (propMap != null && propMap.keySet() != null) {
            for (String propName : propMap.keySet()) {
                Object propVal = propMap.get(propName);
                // lazy create props
                if (props == null) {
                    props = new LinkedList<>();
                }
                PropertyInfo propInfo = toPropInfo(sc, node, propName, propVal, initNodeEdit);
                props.add(propInfo);
            }
        }
        if (props != null) {
            props.sort((a, b) -> a.getName().compareTo(b.getName()));
        }
        return props;
    }

    public static HashMap<String, Object> parseNodeProps(org.bson.Document doc) {
        HashMap<String, Object> props = new HashMap<>();
        // process each property to load
        for (String key : doc.keySet()) {
            Object obj = doc.get(key);
            // of obj is an array then iterate each array element
            if (obj instanceof List) {
                Class<?> clazz = null;
                if (NodeProp.USER_SEACH_DEFINITIONS.s().equals(key)) {
                    clazz = NodeProp.USER_SEACH_DEFINITIONS.getArrayOfType();
                }
                List<Object> typedList = new ArrayList<>();
                // make a list to hold the type-safe objects
                List<?> list = (List<?>) obj;
                // scan each Document in the list and convert it to the correct type
                for (int i = 0; i < list.size(); i++) {
                    Object item = list.get(i);
                    // if item is a document then get the _class property from it
                    if (clazz != null && item instanceof org.bson.Document dItem) {
                        Object ret = null;
                        try {
                            ret = clazz.getConstructor(org.bson.Document.class).newInstance(dItem);
                            typedList.add(ret);
                        } catch (Exception e) {
                            ExUtil.error(log, "failed to load property as type " + clazz.getName() + "\nRaw JSON: "
                                    + XString.prettyPrint(dItem), e);
                        }
                    } else {
                        // need a warning here? Not typesafe, and left as 'Document' instance.
                        typedList.add(item);
                    }
                }
                props.put(key, typedList);
            }
            // else allow the object to be added to the map from a Document (converted) or any other type
            else {
                Object val = doc.get(key);
                if (val instanceof org.bson.Document dItem) {
                    // props.put(key, Convert.convertToType(dItem));
                    log.error("Unable to convert to type: " + dItem);
                } else {
                    props.put(key, val);
                }
            }
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
            throw new RuntimeEx(ex);
        }
    }

    public String basicTextFormatting(String val) {
        val = val.replace("\n\r", "<p>");
        val = val.replace("\n", "<p>");
        val = val.replace("\r", "<p>");
        return val;
    }
}
