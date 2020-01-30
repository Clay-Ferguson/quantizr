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

	//todo-0: this should no longer be needed at all on client! get rid of it.
	private String path;
	
	private String name;
	private String content;
	private Date lastModified;
	private Long logicalOrdinal;
	private Long ordinal;
	private String type;
	private List<PropertyInfo> properties;
	private boolean hasChildren;

	// NOTE: These two booleans are hints for gui enablement (for moveUp, moveDown, etc) in the browser, 
	// and are not necessarily reqired to be always even correct
	private boolean firstChild;
	private boolean lastChild;
	
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
	private String imgId;
	private String owner;

	public NodeInfo() {
	}

	public NodeInfo(String id, String path, String name, String content, String owner, Long ordinal, Date lastModified,
			List<PropertyInfo> properties, boolean hasChildren,
			boolean hasBinary, boolean binaryIsImage, long binVer, int width, int height, String type, long logicalOrdinal,
			boolean firstChild, boolean lastChild) {
		this.id = id;
		this.path = path;
		this.name = name;
		this.content = content;
		this.lastModified = lastModified;
		this.owner = owner;
		this.ordinal = ordinal;
		this.properties = properties;
		this.hasChildren = hasChildren;
		this.firstChild = firstChild;
		this.lastChild = lastChild;
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
}
