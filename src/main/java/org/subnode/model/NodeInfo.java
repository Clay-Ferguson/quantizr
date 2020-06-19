package org.subnode.model;

import java.util.Date;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

/**
 * Primary object passed back to client to represent a 'node'. Client sees the JSON version of this,
 * in javascript.
 */
@JsonInclude(Include.NON_NULL)
public class NodeInfo {
	private static final Logger log = LoggerFactory.getLogger(NodeInfo.class);

	private String id;	
	private String name;
	private String content;
	private Date lastModified;
	private Long logicalOrdinal;
	private Long ordinal;
	private String type;
	private List<PropertyInfo> properties;
	private List<AccessControlInfo> ac;
	private boolean hasChildren;
	private boolean deleted;

	/* For nodes that are encrypted but shared to the current user, we send back the ciperKey (an encrypted sym key) for this node which
	is a key that can only be decrypted by the private key on the user's browser, but decrypted by them on their browser
	it gives the symmetric key to the encrypted data so they can access the encrypted node content with it */
	private String cipherKey;

	// NOTE: These two booleans are hints for gui enablement (for moveUp, moveDown, etc) in the browser, 
	// and are not necessarily reqired to be always even correct
	private boolean firstChild;
	private boolean lastChild;
	
	private int width;
	private int height;

	/* This is only populated when generating user "feeds", because we want the feed to be able to show the 
	context for the reply of a post, which entails showing the parent of the reply above the reply */
	private NodeInfo parent;

	private List<NodeInfo> children;

	/*
	 * These next three WERE (in jcr design) set on Client Side only but I need to
	 * probably set them on server side instead or else completely generate
	 * dynamically if based on properties.
	 */
	private String imgId;
	private String owner;
	private String ownerId;

	private String dataUrl;
	private String avatarVer;

	public NodeInfo() {
	}

	public NodeInfo(String id, String name, String content, String owner, String ownerId, Long ordinal, Date lastModified,
			List<PropertyInfo> properties, List<AccessControlInfo> ac, boolean hasChildren,
		 int width, int height, String type, long logicalOrdinal,
			boolean firstChild, boolean lastChild, String cipherKey, String dataUrl, boolean deleted, String avatarVer) {
		this.id = id;
		this.name = name;
		this.content = content;
		this.lastModified = lastModified;
		this.owner = owner;
		this.ownerId = ownerId;
		this.ordinal = ordinal;
		this.properties = properties;
		this.ac = ac;
		this.hasChildren = hasChildren;
		this.firstChild = firstChild;
		this.lastChild = lastChild;
		this.width = width;
		this.height = height;
		this.type = type;
		this.logicalOrdinal = logicalOrdinal;
		this.cipherKey = cipherKey;
		this.dataUrl = dataUrl;
		this.deleted = deleted;
		this.avatarVer = avatarVer;
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

	public boolean isFirstChild() {
		return this.firstChild;
	}

	public void setFirstChild(boolean firstChild) {
		this.firstChild = firstChild;
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

	public boolean isDeleted() {
		return deleted;
	}

	public void setDeleted(boolean deleted) {
		this.deleted = deleted;
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
}
