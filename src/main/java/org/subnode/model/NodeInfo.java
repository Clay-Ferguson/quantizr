package org.subnode.model;

import java.util.Date;
import java.util.LinkedList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.annotation.Transient;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

/**
 * Primary object passed back to client to represent a 'node'. Client sees the
 * JSON version of this, in javascript.
 */
@JsonInclude(Include.NON_NULL)
public class NodeInfo {
	private static final Logger log = LoggerFactory.getLogger(NodeInfo.class);

	private String id;
	private String path;
	private String name;
	private String content;
	private Date lastModified;

	// todo-1: make this show something like 1hr ago or 2d ago, etc using DateUtil.formatDurationMillis,
	// and then let the GUI show that instad of the time.
	// private String timeAgo;

	// This is the 0-offset position (index) of the node within the resultset that
	// queried it, and is relative not to a specific page
	// but the entire resultset.
	private Long logicalOrdinal;

	private Long ordinal;
	private String type;
	private List<PropertyInfo> properties;

	/*
	 * Holds information that the server needs to send back to the client to support
	 * client features, but that are not actually stored properties on the actual
	 * node
	 */
	private List<PropertyInfo> clientProps;

	private List<AccessControlInfo> ac;
	private boolean hasChildren;

	/*
	 * For nodes that are encrypted but shared to the current user, we send back the
	 * ciperKey (an encrypted sym key) for this node which is a key that can only be
	 * decrypted by the private key on the user's browser, but decrypted by them on
	 * their browser it gives the symmetric key to the encrypted data so they can
	 * access the encrypted node content with it
	 */
	private String cipherKey;

	// NOTE: These two booleans are hints for gui enablement (for moveUp, moveDown,
	// etc) in the browser,
	// and are not necessarily reqired to be always even correct
	private boolean lastChild;

	private int width;
	private int height;

	/*
	 * This is only populated when generating user "feeds", because we want the feed
	 * to be able to show the context for the reply of a post, which entails showing
	 * the parent of the reply above the reply
	 */
	private NodeInfo parent;

	private List<NodeInfo> children;

	private String imgId;
	private String owner;
	private String ownerId;

	private String dataUrl;
	private String avatarVer;
	private String apAvatar;

	public NodeInfo() {
	}

	public NodeInfo(String id, String path, String name, String content, String owner, String ownerId, Long ordinal,
			Date lastModified, List<PropertyInfo> properties, List<AccessControlInfo> ac, boolean hasChildren,
			int width, int height, String type, long logicalOrdinal, boolean lastChild, String cipherKey,
			String dataUrl, String avatarVer, String apAvatar) {
		this.id = id;
		this.path = path;
		this.name = name;
		this.content = content;
		this.lastModified = lastModified;
		this.owner = owner;
		this.ownerId = ownerId;
		this.ordinal = ordinal;
		this.logicalOrdinal = logicalOrdinal;
		this.properties = properties;
		this.ac = ac;
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
	}

	@Transient
	@JsonIgnore
	public String getPropVal(String propName) {
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
	public void setPropVal(String propName, String val) {
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

	public String getContent() {
		return content;
	}

	public void setContent(String content) {
		this.content = content;
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
		if (children != null)
			return children;
		return children = new LinkedList<NodeInfo>();
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
		if (properties != null)
			return properties;
		return properties = new LinkedList<PropertyInfo>();
	}

	public List<PropertyInfo> getProperties() {
		return properties;
	}

	public void setProperties(List<PropertyInfo> properties) {
		this.properties = properties;
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
		if (clientProps != null)
			return clientProps;
		return clientProps = new LinkedList<PropertyInfo>();
	}

	public List<PropertyInfo> getClientProps() {
		return clientProps;
	}

	public void setClientProps(List<PropertyInfo> clientProps) {
		this.clientProps = clientProps;
	}
}
