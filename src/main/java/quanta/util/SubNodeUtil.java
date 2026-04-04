package quanta.util;

import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.NodeMetaInfo;
import quanta.model.PropertyInfo;
import quanta.model.client.Attachment;
import quanta.model.client.NodeProp;
import quanta.model.client.PrincipalName;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.CreateNodeLocation;
import quanta.mongo.model.SubNode;
import quanta.service.AppController;
import quanta.util.val.Val;

/**
 * Assorted general utility functions related to SubNodes.
 */
@Component
public class SubNodeUtil extends ServiceBase {
    @SuppressWarnings("unused")
    private Logger log = LoggerFactory.getLogger(SubNodeUtil.class);

    private static final ObjectMapper mapper =
            JsonMapper.builder().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
                    .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true)
                    .configure(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS, true)
                    .serializationInclusion(JsonInclude.Include.NON_NULL).build();

    public static String toCanonicalJson(Object obj) {
        if (obj == null) {
            return "null";
        }
        if (obj instanceof String) {
            return (String) obj;
        }
        try {
            return mapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return "";
        }
    }

    public boolean hasBasicPositioning(Attachment att) {
        if (att == null) {
            return false;
        }
        String pos = att.getPosition();
        if (pos == null) {
            return false;
        }
        return pos.equals("ul") || pos.equals("ur") || pos.equals("c");
    }

    public void removeProp(List<PropertyInfo> list, String name) {
        if (list == null || name == null) {
            return;
        }

        Iterator<PropertyInfo> iterator = list.iterator();
        while (iterator.hasNext()) {
            PropertyInfo property = iterator.next();
            if (name.equals(property.getName())) {
                iterator.remove();
            }
        }
    }

    public boolean validNodeName(String name) {
        if (name == null || name.length() == 0) {
            return false;
        }
        int sz = name.length();

        for (int i = 0; i < sz; i++) {
            char c = name.charAt(i);
            if (c == '-' || c == '_' || c == '.')
                continue;
            if (!Character.isLetterOrDigit(c)) {
                return false;
            }
        }
        return true;
    }

    /*
     * For properties that are being set to their default behaviors as if the property didn't exist
     * (such as vertical layout is assumed if no layout property is specified) we remove those
     * properties when the client is passing them in to be saved, or from any other source they are
     * being passed to be saved
     *
     * returns 'true' only if something changed
     */
    public boolean removeDefaultProps(SubNode node) {
        boolean ret = false;
        // If layout=="v" then remove the property
        String layout = node.getStr(NodeProp.LAYOUT);
        if ("v".equals(layout)) {
            node.delete(NodeProp.LAYOUT);
            ret = true;
        }
        // If priority=="0" then remove the property
        String priority = node.getStr(NodeProp.PRIORITY);
        if ("0".equals(priority)) {
            node.delete(NodeProp.PRIORITY);
            ret = true;
        }
        if (node.getProps() != null && node.getProps().size() == 0) {
            ret = true;
            node.setProps(null);
        }
        return ret;
    }

    public HashMap<String, AccessControl> cloneAcl(SubNode node) {
        if (node.getAc() == null)
            return null;
        return new HashMap<String, AccessControl>(node.getAc());
    }

    /*
     * Currently there's a bug in the client code where it sends nulls for some non-savable types, so
     * before even fixing the client I decided to just make the server side block those. This is more
     * secure to always have the server allow misbehaving javascript for security reasons.
     */
    public static boolean isReadonlyProp(String propName) {
        if (propName.equals(NodeProp.BIN.s()) || //
                propName.equals(NodeProp.BIN_TOTAL.s()) || //
                propName.equals(NodeProp.BIN_QUOTA.s())) {
            return false;
        }
        return true;
    }

    public String getFriendlyNodeUrl(SubNode node) {
        // if node doesn't thave a name, make ID-based url
        if (StringUtils.isEmpty(node.getName())) {
            return String.format("%s?id=%s", svc_prop.getHostAndPort(), node.getIdStr());
        } else { // else format this node name based on whether the node is admin owned or not.
            String owner = svc_mongoRead.getNodeOwner(node);
            // if admin owns node
            if (owner.equalsIgnoreCase(PrincipalName.ADMIN.s())) {
                return String.format("%s/n/%s", svc_prop.getHostAndPort(), node.getName());
            } else { // if non-admin owns node
                return String.format("%s/u/%s/%s", svc_prop.getHostAndPort(), owner, node.getName());
            }
        }
    }

    public String getFriendlyHtmlUrl(SubNode node) {
        // if node doesn't thave a name, make ID-based url
        if (StringUtils.isEmpty(node.getName())) {
            return String.format("%s/pub/id/%s", svc_prop.getHostAndPort(), node.getIdStr());
        } else { // else format this node name based on whether the node is admin owned or not.
            String owner = svc_mongoRead.getNodeOwner(node);
            // if admin owns node
            if (owner.equalsIgnoreCase(PrincipalName.ADMIN.s())) {
                return String.format("%s/pub/%s", svc_prop.getHostAndPort(), node.getName());
            } else { // if non-admin owns node
                return String.format("%s/pub/%s/%s", svc_prop.getHostAndPort(), owner, node.getName());
            }
        }
    }

    /**
     * Ensures that a node exists at the specified path. If the node does not exist, it will be created
     * along with any necessary parent nodes.
     *
     * @param parentPath The path of the parent node.
     * @param pathName The name of the node to ensure exists.
     * @param defaultContent The default content to set if the node is created.
     * @param primaryTypeName The primary type name of the node.
     * @param nodeClass The class type of the node.
     * @param saveImmediate Whether to save the session immediately after creating nodes.
     * @param props Additional properties to set on the node.
     * @param created A boolean value holder that will be set to true if the node was created, false if
     *        it already existed.
     * @return The existing or newly created node.
     * @throws RuntimeEx If the parent node is expected but not found, or if a node cannot be created.
     */
    public SubNode ensureNodeExists(String parentPath, String pathName, String defaultContent, String primaryTypeName,
            Class<? extends SubNode> nodeClass, boolean saveImmediate, HashMap<String, Object> props,
            Val<Boolean> created) {

        if (!parentPath.endsWith("/")) {
            parentPath += "/";
        }
        SubNode node = svc_mongoRead.getNode(fixPath(parentPath + pathName));
        // if we found the node and it's name matches (if provided)
        if (node != null) {
            if (created != null) {
                created.setVal(false);
            }
            return node;
        }
        if (created != null) {
            created.setVal(true);
        }
        List<String> toks = XString.tokenize(pathName, "/", true);
        if (toks == null) {
            return null;
        }
        SubNode parent = null;
        if (!parentPath.equals("/")) {
            parent = svc_mongoRead.getNode(parentPath);
            if (parent == null) {
                throw new RuntimeEx("Expected parent not found: " + parentPath);
            }
        }
        boolean nodesCreated = false;

        for (String tok : toks) {
            String path = fixPath(parentPath + tok);
            node = svc_mongoRead.getNode(path);
            // if this node is found continue on, using it as current parent to build on
            if (node != null) {
                parent = node;
            } else {
                // Note if parent PARAMETER here is null we are adding a root node
                parent = svc_mongoCreate.createNode(parent, tok, primaryTypeName, nodeClass, 0L,
                        CreateNodeLocation.LAST, null, null, true, true, null);
                if (parent == null) {
                    throw new RuntimeEx("unable to create " + tok);
                }
                nodesCreated = true;
                if (defaultContent == null) {
                    parent.setContent("");
                    parent.touch();
                }
                svc_mongoUpdate.save(parent);
            }
            parentPath += tok + "/";
        }

        if (defaultContent != null) {
            parent.setContent(defaultContent);
            parent.touch();
        }
        if (props != null) {
            parent.addProps(props);
        }
        if (saveImmediate && nodesCreated) {
            svc_mongoUpdate.saveSession();
        }
        return parent;
    }

    public static String fixPath(String path) {
        return path.replace("//", "/");
    }

    public String getExportFileName(String fileName, SubNode node) {
        if (!StringUtils.isEmpty(fileName)) {
            // truncate any file name extension.
            fileName = XString.truncAfterLast(fileName, ".");
            return fileName;
        } //
        else if (node.getName() != null) {
            return node.getName();
        } else {
            return "f" + getGUID();
        }
    }

    /*
     * I've decided 64 bits of randomness is good enough, instead of 128, thus we are dicing up the
     * string to use every other character. If you want to modify this method to return a full UUID that
     * will not cause any problems, other than default node names being the full string, which is kind
     * of long
     */
    public String getGUID() {
        String uid = UUID.randomUUID().toString();
        StringBuilder sb = new StringBuilder();
        int len = uid.length();
        // chop length in half by using every other character
        for (int i = 0; i < len; i += 2) {
            char c = uid.charAt(i);
            if (c == '-') {
                i--;
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
        /*
         * WARNING: I remember there are some cases where SecureRandom can hang on non-user machines (i.e.
         * production servers), as they rely no some OS level sources of entropy that may be dormant at the
         * time. Be careful. here's another way to generate a random 64bit number...
         */
        // if (no(prng )) {
        // prng = SecureRandom.getInstance("SHA1PRNG");
        // }
        //
        // return String.valueOf(prng.nextLong());
    }

    /**
     * Retrieves metadata information for a given node.
     *
     * @param node the node for which metadata information is to be retrieved
     * @return a NodeMetaInfo object containing metadata information about the node, or null if the node
     *         is null
     */
    public NodeMetaInfo getNodeMetaInfo(SubNode node) {
        if (node == null)
            return null;
        NodeMetaInfo ret = new NodeMetaInfo();
        String description = node.getContent();
        if (description == null) {
            if (node.getName() != null) {
                description = "Node Name: " + node.getName();
            } else {
                description = "Node ID: " + node.getIdStr();
            }
        }
        int newLineIdx = description.indexOf("\n");
        if (newLineIdx != -1) {
            // call this once to start just so the title extraction works.
            description = svc_render.stripRenderTags(description);
            // get the new idx, it might have changed.
            newLineIdx = description.indexOf("\n");
            String ogTitle = newLineIdx > 2 ? description.substring(0, newLineIdx).trim() : "";
            ogTitle = svc_render.stripRenderTags(ogTitle);
            ret.setTitle(ogTitle);
            if (newLineIdx > 2) {
                description = description.substring(newLineIdx).trim();
            }
            description = svc_render.stripRenderTags(description);
            ret.setDescription(description);
        } else {
            ret.setTitle("Quanta");
            description = svc_render.stripRenderTags(description);
            ret.setDescription(description);
        }
        String url = getFirstAttachmentUrl(node);
        String mime = null;
        Attachment att = node.getFirstAttachment();
        if (att != null) {
            mime = att.getMime();
        }
        if (url == null) {
            url = svc_prop.getHostAndPort() + "/branding/logo-200px-tr.jpg";
            mime = "image/jpeg";
        }
        ret.setAttachmentUrl(url);
        ret.setAttachmentMime(mime);
        ret.setUrl(svc_prop.getHostAndPort() + "?id=" + node.getIdStr());
        return ret;
    }

    public String getFirstAttachmentUrl(SubNode node) {
        Attachment att = node.getFirstAttachment();
        if (att == null)
            return null;

        String bin = att.getBin();
        if (bin != null) {
            return svc_prop.getHostAndPort() + AppController.API_PATH + "/bin/" + bin + "?nodeId=" + node.getIdStr();
        }
        // as last resort try to get any extrnally linked binary image
        if (bin == null) {
            bin = att.getUrl();
        }
        return bin;
    }

    public String getIdBasedUrl(SubNode node) {
        return svc_prop.getProtocolHostAndPort() + "?id=" + node.getIdStr();
    }
}
