package quanta.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.annotation.Transient;
import quanta.model.client.Attachment;
import quanta.model.client.NodeLink;
import quanta.util.DateUtil;

/**
 * Primary object passed back to client to represent a 'node'. Client sees the JSON version of this,
 * in javascript.
 */
@JsonInclude(Include.NON_NULL)
public class NodeInfo {
    @SuppressWarnings("unused")
    private static Logger log = LoggerFactory.getLogger(NodeInfo.class);
    private String id;
    private String path;
    private String name;
    private String content;
    // This is the markdown to RENDER and MAY be different from 'content'
    private String renderContent;
    private String tags;
    private Long lastModified;
    private String timeAgo;
    // This is the 0-offset position (index) of the node within the resultset that
    // queried it, and is relative not to a specific page
    // but the entire resultset.
    private Long logicalOrdinal;
    private Long ordinal;
    private String type;
    private List<PropertyInfo> properties;
    private HashMap<String, Attachment> attachments;
    private List<NodeLink> links;
    /*
     * Holds information that the server needs to send back to the client to support client features,
     * but that are not actually stored properties on the actual node
     */
    private List<PropertyInfo> clientProps;
    private List<AccessControlInfo> ac;
    private boolean hasChildren;
    /*
     * For nodes that are encrypted but shared to the current user, we send back the ciperKey (an
     * encrypted sym key) for this node which is a key that can only be decrypted by the private key on
     * the user's browser, but decrypted by them on their browser it gives the symmetric key to the
     * encrypted data so they can access the encrypted node content with it
     */
    private String cipherKey;
    // NOTE: Just a hint for gui enablement (for moveUp, moveDown, etc) in the browser,
    private boolean lastChild;
    /*
     * This is only populated when generating user "feeds", because we want the feed to be able to show
     * the context for the reply of a post, which entails showing the parent of the reply above the
     * reply
     */
    private List<NodeInfo> children;

    private LinkedList<NodeInfo> linkedNodes;
    private List<String> likes;
    private String imgId;
    private String displayName;
    private String owner;
    private String ownerId;
    private String transferFromId;
    private String avatarVer;
    private String apAvatar;
    private String apImage;

    public NodeInfo(String id, String path, String name, String content, String renderContent, String tags,
            String displayName, String owner, String ownerId, String transferFromId, Long ordinal, Date lastModified,
            List<PropertyInfo> properties, HashMap<String, Attachment> attachments, List<NodeLink> links,
            List<AccessControlInfo> ac, List<String> likes, boolean hasChildren, String type, long logicalOrdinal,
            boolean lastChild, String cipherKey, String avatarVer) {
        this.id = id;
        this.path = path;
        this.name = name;
        this.content = content;
        this.renderContent = renderContent;
        this.tags = tags;
        this.lastModified = lastModified.getTime();
        if (lastModified != null) {
            this.timeAgo = DateUtil.formatDurationMillis(System.currentTimeMillis() - lastModified.getTime(), false);
        }
        this.displayName = displayName;
        this.owner = owner;
        this.ownerId = ownerId;
        this.transferFromId = transferFromId;
        this.ordinal = ordinal;
        this.logicalOrdinal = logicalOrdinal;
        this.properties = properties;
        this.attachments = attachments;
        this.links = links;
        this.ac = ac;
        this.likes = likes;
        this.hasChildren = hasChildren;
        this.lastChild = lastChild;
        this.type = type;
        this.cipherKey = cipherKey;
        this.avatarVer = avatarVer;
    }

    @Transient
    @JsonIgnore
    public Object getPropVal(String propName) {
        if (properties == null)
            return null;

        for (PropertyInfo prop : properties) {
            if (prop.getName().equals(propName)) {
                return prop.getValue();
            }
        }
        return null;
    }

    @Transient
    @JsonIgnore
    public void setPropVal(String propName, Object val) {
        if (properties == null) {
            safeGetProperties().add(new PropertyInfo(propName, val));
            return;
        }
        /* Set property to new value if it exists already */
        for (PropertyInfo prop : properties) {
            if (prop.getName().equals(propName)) {
                prop.setValue(val);
                return;
            }
        }
        safeGetProperties().add(new PropertyInfo(propName, val));
    }

    public List<NodeInfo> safeGetChildren() {
        if (children != null)
            return children;
        return children = new LinkedList<>();
    }

    public List<PropertyInfo> safeGetProperties() {
        if (properties != null)
            return properties;
        return properties = new LinkedList<>();
    }

    public List<PropertyInfo> safeGetClientProps() {
        if (clientProps != null)
            return clientProps;
        return clientProps = new LinkedList<>();
    }

    public String getId() {
        return this.id;
    }

    public String getPath() {
        return this.path;
    }

    public String getName() {
        return this.name;
    }

    public String getContent() {
        return this.content;
    }

    public String getRenderContent() {
        return this.renderContent;
    }

    public String getTags() {
        return this.tags;
    }

    public Long getLastModified() {
        return this.lastModified;
    }

    public String getTimeAgo() {
        return this.timeAgo;
    }

    public Long getLogicalOrdinal() {
        return this.logicalOrdinal;
    }

    public Long getOrdinal() {
        return this.ordinal;
    }

    public String getType() {
        return this.type;
    }

    public List<PropertyInfo> getProperties() {
        return this.properties;
    }

    public HashMap<String, Attachment> getAttachments() {
        return this.attachments;
    }

    public List<NodeLink> getLinks() {
        return this.links;
    }

    public List<PropertyInfo> getClientProps() {
        return this.clientProps;
    }

    public List<AccessControlInfo> getAc() {
        return this.ac;
    }

    public boolean isHasChildren() {
        return this.hasChildren;
    }

    public String getCipherKey() {
        return this.cipherKey;
    }

    public boolean isLastChild() {
        return this.lastChild;
    }

    public List<NodeInfo> getChildren() {
        return this.children;
    }

    public LinkedList<NodeInfo> getLinkedNodes() {
        return this.linkedNodes;
    }

    public List<String> getLikes() {
        return this.likes;
    }

    public String getImgId() {
        return this.imgId;
    }

    public String getDisplayName() {
        return this.displayName;
    }

    public String getOwner() {
        return this.owner;
    }

    public String getOwnerId() {
        return this.ownerId;
    }

    public String getTransferFromId() {
        return this.transferFromId;
    }

    public String getAvatarVer() {
        return this.avatarVer;
    }

    public String getApAvatar() {
        return this.apAvatar;
    }

    public String getApImage() {
        return this.apImage;
    }

    public void setId(final String id) {
        this.id = id;
    }

    public void setPath(final String path) {
        this.path = path;
    }

    public void setName(final String name) {
        this.name = name;
    }

    public void setContent(final String content) {
        this.content = content;
    }

    public void setRenderContent(final String renderContent) {
        this.renderContent = renderContent;
    }

    public void setTags(final String tags) {
        this.tags = tags;
    }

    public void setLastModified(final Long lastModified) {
        this.lastModified = lastModified;
    }

    public void setTimeAgo(final String timeAgo) {
        this.timeAgo = timeAgo;
    }

    public void setLogicalOrdinal(final Long logicalOrdinal) {
        this.logicalOrdinal = logicalOrdinal;
    }

    public void setOrdinal(final Long ordinal) {
        this.ordinal = ordinal;
    }

    public void setType(final String type) {
        this.type = type;
    }

    public void setProperties(final List<PropertyInfo> properties) {
        this.properties = properties;
    }

    public void setAttachments(final HashMap<String, Attachment> attachments) {
        this.attachments = attachments;
    }

    public void setLinks(final List<NodeLink> links) {
        this.links = links;
    }

    public void setClientProps(final List<PropertyInfo> clientProps) {
        this.clientProps = clientProps;
    }

    public void setAc(final List<AccessControlInfo> ac) {
        this.ac = ac;
    }

    public void setHasChildren(final boolean hasChildren) {
        this.hasChildren = hasChildren;
    }

    public void setCipherKey(final String cipherKey) {
        this.cipherKey = cipherKey;
    }

    public void setLastChild(final boolean lastChild) {
        this.lastChild = lastChild;
    }

    public void setChildren(final List<NodeInfo> children) {
        this.children = children;
    }

    public void setLinkedNodes(final LinkedList<NodeInfo> linkedNodes) {
        this.linkedNodes = linkedNodes;
    }

    public void setLikes(final List<String> likes) {
        this.likes = likes;
    }

    public void setImgId(final String imgId) {
        this.imgId = imgId;
    }

    public void setDisplayName(final String displayName) {
        this.displayName = displayName;
    }

    public void setOwner(final String owner) {
        this.owner = owner;
    }

    public void setOwnerId(final String ownerId) {
        this.ownerId = ownerId;
    }

    public void setTransferFromId(final String transferFromId) {
        this.transferFromId = transferFromId;
    }

    public void setAvatarVer(final String avatarVer) {
        this.avatarVer = avatarVer;
    }

    public void setApAvatar(final String apAvatar) {
        this.apAvatar = apAvatar;
    }

    public void setApImage(final String apImage) {
        this.apImage = apImage;
    }

    public NodeInfo() {}
}
