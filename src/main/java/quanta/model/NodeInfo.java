package quanta.model;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import quanta.model.client.Attachment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.annotation.Transient;

/**
 * Primary object passed back to client to represent a 'node'. Client sees the JSON version of this,
 * in javascript.
 */
@JsonInclude(Include.NON_NULL)
public class NodeInfo {
	private static final Logger log = LoggerFactory.getLogger(NodeInfo.class);

	private String id;
	private String path;
	private String name;
	private String content;
	private String tags;

	private Date lastModified;

	// todo-2: make this show something like 1hr ago or 2d ago, etc using DateUtil.formatDurationMillis,
	// and then let the GUI show that instad of the time, unless hovered over
	// private String timeAgo;

	// This is the 0-offset position (index) of the node within the resultset that
	// queried it, and is relative not to a specific page
	// but the entire resultset.
	private Long logicalOrdinal;

	private Long ordinal;
	private String type;
	private List<PropertyInfo> properties;
	private HashMap<String, Attachment> attachments;

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

	private int width;
	private int height;

	/*
	 * This is only populated when generating user "feeds", because we want the feed to be able to show
	 * the context for the reply of a post, which entails showing the parent of the reply above the
	 * reply
	 */
	private NodeInfo parent;

	private List<NodeInfo> children;

	// This is optional, and will be non-empty whenever we're wanting not just the children of this node
	// but all the parents up to a certain number of parents, up towards the root, however many levels up.
	private LinkedList<NodeInfo> parents;

	private List<String> likes;

	private String imgId;
	private String displayName;
	private String owner;
	private String ownerId;

	private String dataUrl;
	private String avatarVer;
	private String apAvatar;
	private String apImage;

	// if this node is a boost we put in the target node (node being boosted here)
	private NodeInfo boostedNode;

	public NodeInfo() {}

	public NodeInfo(String id, String path, String name, String content, String tags, String displayName, String owner, String ownerId,
			Long ordinal, Date lastModified, List<PropertyInfo> properties, HashMap<String, Attachment> attachments, List<AccessControlInfo> ac, List<String> likes, boolean hasChildren,
			int width, int height, String type, long logicalOrdinal, boolean lastChild, String cipherKey, String dataUrl,
			String avatarVer, String apAvatar, String apImage) {
		this.id = id;
		this.path = path;
		this.name = name;
		this.content = content;
		this.tags = tags;
		this.lastModified = lastModified;
		this.displayName = displayName;
		this.owner = owner;
		this.ownerId = ownerId;
		this.ordinal = ordinal;
		this.logicalOrdinal = logicalOrdinal;
		this.properties = properties;
		this.attachments = attachments;
		this.ac = ac;
		this.likes = likes;
		this.hasChildren = hasChildren;
		this.lastChild = lastChild;
		this.width = width;
		this.height = height;
		this.type = type;
		this.logicalOrdinal = logicalOrdinal;
		this.cipherKey = cipherKey;
		this.dataUrl = dataUrl;
		this.avatarVer = avatarVer;
		this.apAvatar = apAvatar;
		this.apImage = apImage;
	}

	@Transient
	@JsonIgnore
	public Object getPropVal(String propName) {
		if (no(properties))
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
		if (no(properties)) {
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

	public String getContent() {
		return content;
	}

	public void setContent(String content) {
		this.content = content;
	}

	public String getTags() {
		return tags;
	}

	public void setTag(String tags) {
		this.tags = tags;
	}

	public String getCipherKey() {
		return cipherKey;
	}

	public void setCipherKey(String cipherKey) {
		this.cipherKey = cipherKey;
	}

	public Date getLastModified() {
		return lastModified;
	}

	public void setLastModified(Date lastModified) {
		this.lastModified = lastModified;
	}

	public List<NodeInfo> safeGetChildren() {
		if (ok(children))
			return children;
		return children = new LinkedList<>();
	}

	public List<NodeInfo> getChildren() {
		return children;
	}

	public void setChildren(List<NodeInfo> children) {
		this.children = children;
	}

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public List<PropertyInfo> safeGetProperties() {
		if (ok(properties))
			return properties;
		return properties = new LinkedList<>();
	}

	public List<PropertyInfo> getProperties() {
		return properties;
	}

	public void setProperties(List<PropertyInfo> properties) {
		this.properties = properties;
	}

	public HashMap<String, Attachment> getAttachments() {
		return attachments;
	}

	public void setAttachments(HashMap<String, Attachment> attachments) {
		this.attachments = attachments;
	}

	public List<AccessControlInfo> getAc() {
		return ac;
	}

	public void setAc(List<AccessControlInfo> ac) {
		this.ac = ac;
	}

	public boolean isHasChildren() {
		return hasChildren;
	}

	public void setHasChildren(boolean hasChildren) {
		this.hasChildren = hasChildren;
	}

	public int getWidth() {
		return width;
	}

	public void setWidth(int width) {
		this.width = width;
	}

	public int getHeight() {
		return height;
	}

	public void setHeight(int height) {
		this.height = height;
	}

	public String getType() {
		return type;
	}

	public void setType(String type) {
		this.type = type;
	}

	public String getImgId() {
		return imgId;
	}

	public void setImgId(String imgId) {
		this.imgId = imgId;
	}

	public String getOwner() {
		return owner;
	}

	public void setOwner(String owner) {
		this.owner = owner;
	}

	public String getOwnerId() {
		return ownerId;
	}

	public void setOwnerId(String ownerId) {
		this.ownerId = ownerId;
	}

	public Long getOrdinal() {
		return ordinal;
	}

	public void setOrdinal(Long ordinal) {
		this.ordinal = ordinal;
	}

	public Long getLogicalOrdinal() {
		return logicalOrdinal;
	}

	public void setLogicalOrdinal(Long logicalOrdinal) {
		this.logicalOrdinal = logicalOrdinal;
	}

	public boolean isLastChild() {
		return this.lastChild;
	}

	public void setLastChild(boolean lastChild) {
		this.lastChild = lastChild;
	}

	public String getDataUrl() {
		return dataUrl;
	}

	public void setDataUrl(String dataUrl) {
		this.dataUrl = dataUrl;
	}

	public String getAvatarVer() {
		return avatarVer;
	}

	public void setAvatarVer(String avatarVer) {
		this.avatarVer = avatarVer;
	}

	public String getApImage() {
		return apImage;
	}

	public void setApImage(String apImage) {
		this.apImage = apImage;
	}

	public NodeInfo getParent() {
		return parent;
	}

	public void setParent(NodeInfo parent) {
		this.parent = parent;
	}

	public String getPath() {
		return path;
	}

	public void setPath(String path) {
		this.path = path;
	}

	public String getApAvatar() {
		return apAvatar;
	}

	public void setApAvatar(String apAvatar) {
		this.apAvatar = apAvatar;
	}

	public List<PropertyInfo> safeGetClientProps() {
		if (ok(clientProps))
			return clientProps;
		return clientProps = new LinkedList<>();
	}

	public List<PropertyInfo> getClientProps() {
		return clientProps;
	}

	public void setClientProps(List<PropertyInfo> clientProps) {
		this.clientProps = clientProps;
	}

	public String getDisplayName() {
		return displayName;
	}

	public void setDisplayName(String displayName) {
		this.displayName = displayName;
	}

	public LinkedList<NodeInfo> getParents() {
		return parents;
	}

	public void setParents(LinkedList<NodeInfo> parents) {
		this.parents = parents;
	}

	public List<String> getLikes() {
		return likes;
	}

	public void setLikes(List<String> likes) {
		this.likes = likes;
	}

	public NodeInfo getBoostedNode() {
		return boostedNode;
	}

	public void setBoostedNode(NodeInfo boostedNode) {
		this.boostedNode = boostedNode;
	}
}
