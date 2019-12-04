package org.subnode.model;

import java.util.Date;
import java.util.List;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Primary object passed back to client to represent a 'node'. Client sees the JSON version of this,
 * in javascript.
 */
public class NodeInfo {
	private static final Logger log = LoggerFactory.getLogger(NodeInfo.class);

	private String id;
	private String path;
	private String content;
	private Date lastModified;
	private Long logicalOrdinal;
	private Long ordinal;
	private String type;
	private List<PropertyInfo> properties;
	private boolean hasChildren;
	private boolean hasBinary;
	private boolean binaryIsImage;
	private long binVer;
	private int width;
	private int height;

	private List<NodeInfo> children;

	/*
	 * These next three WERE (in jcr design) set on Client Side only but I need to
	 * probably set them on server side instead or else completely generate
	 * dynamically if based on properties.
	 */
	private String uid; 
	private String imgId;
	private String owner;

	public NodeInfo() {
	}

	public NodeInfo(String id, String path, String content, String owner, Long ordinal, Date lastModified,
			List<PropertyInfo> properties, boolean hasChildren,
			boolean hasBinary, boolean binaryIsImage, long binVer, int width, int height, String type, long logicalOrdinal) {
		this.id = id;
		this.path = path;
		this.content = content;
		this.lastModified = lastModified;
		this.owner = owner;
		this.ordinal = ordinal;
		this.properties = properties;
		this.hasChildren = hasChildren;
		this.hasBinary = hasBinary;
		this.binaryIsImage = binaryIsImage;
		this.binVer = binVer;
		this.width = width;
		this.height = height;
		this.type = type;
		this.logicalOrdinal = logicalOrdinal;
	}

	public String getContent() {
		return content;
	}

	public void setContent(String content) {
		this.content = content;
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

	public String getPath() {
		return path;
	}

	public void setPath(String path) {
		this.path = path;
	}

	

	public List<PropertyInfo> getProperties() {
		return properties;
	}

	public void setProperties(List<PropertyInfo> properties) {
		this.properties = properties;
	}

	public boolean isHasChildren() {
		return hasChildren;
	}

	public void setHasChildren(boolean hasChildren) {
		this.hasChildren = hasChildren;
	}

	public boolean isHasBinary() {
		return hasBinary;
	}

	public void setHasBinary(boolean hasBinary) {
		this.hasBinary = hasBinary;
	}

	public boolean isBinaryIsImage() {
		return binaryIsImage;
	}

	public void setBinaryIsImage(boolean binaryIsImage) {
		this.binaryIsImage = binaryIsImage;
	}

	public long getBinVer() {
		return binVer;
	}

	public void setBinVer(long binVer) {
		this.binVer = binVer;
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

	public String getUid() {
		return uid;
	}

	public void setUid(String uid) {
		this.uid = uid;
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
}
