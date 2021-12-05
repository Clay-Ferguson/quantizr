package org.subnode.mongo.model;

import java.util.Date;
import java.util.HashMap;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Pure Pojo equivalent of SubNode.java, so we can do serialization to/from JSON without MongoDB trying 
 * to get involved (no PersistenceConstructor issues)
 */
@JsonInclude(Include.NON_NULL)
@JsonPropertyOrder({SubNode.FIELD_PATH, SubNode.FIELD_CONTENT, SubNode.FIELD_NAME, SubNode.FIELD_ID,
		SubNode.FIELD_MAX_CHILD_ORDINAL, SubNode.FIELD_ORDINAL, SubNode.FIELD_OWNER, SubNode.FIELD_CREATE_TIME,
		SubNode.FIELD_MODIFY_TIME, SubNode.FIELD_AC, SubNode.FIELD_PROPERTIES})
public class SubNodePojo {
	private static final Logger log = LoggerFactory.getLogger(SubNodePojo.class);

	@JsonProperty(SubNode.FIELD_ID)
	private ObjectId id;

	@JsonProperty(SubNode.FIELD_ORDINAL)
	private Long ordinal;

	@JsonProperty(SubNode.FIELD_MAX_CHILD_ORDINAL)
	private Long maxChildOrdinal;

	@JsonProperty(SubNode.FIELD_PATH)
	private String path;

	@JsonProperty(SubNode.FIELD_TYPE)
	private String type;

	@JsonProperty(SubNode.FIELD_CONTENT)
	private String content;

	@JsonProperty(SubNode.FIELD_NAME)
	private String name;

	@JsonProperty(SubNode.FIELD_OWNER)
	private ObjectId owner;

	@JsonProperty(SubNode.FIELD_CREATE_TIME)
	private Date createTime;

	@JsonProperty(SubNode.FIELD_MODIFY_TIME)
	private Date modifyTime;

	@JsonProperty(SubNode.FIELD_PROPERTIES)
	private SubNodePropertyMap properties;

	@JsonProperty(SubNode.FIELD_AC)
	private HashMap<String, AccessControl> ac;

	public SubNodePojo() {
	}

	public ObjectId getId() {
		return id;
	}

	public void setId(ObjectId id) {
		this.id = id;
	}

	public Long getOrdinal() {
		return ordinal;
	}

	public void setOrdinal(Long ordinal) {
		this.ordinal = ordinal;
	}

	public Long getMaxChildOrdinal() {
		return maxChildOrdinal;
	}

	public void setMaxChildOrdinal(Long maxChildOrdinal) {
		this.maxChildOrdinal = maxChildOrdinal;
	}

	public String getPath() {
		return path;
	}

	public void setPath(String path) {
		this.path = path;
	}

	public String getType() {
		return type;
	}

	public void setType(String type) {
		this.type = type;
	}

	public String getContent() {
		return content;
	}

	public void setContent(String content) {
		this.content = content;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public ObjectId getOwner() {
		return owner;
	}

	public void setOwner(ObjectId owner) {
		this.owner = owner;
	}

	public Date getCreateTime() {
		return createTime;
	}

	public void setCreateTime(Date createTime) {
		this.createTime = createTime;
	}

	public Date getModifyTime() {
		return modifyTime;
	}

	public void setModifyTime(Date modifyTime) {
		this.modifyTime = modifyTime;
	}

	public SubNodePropertyMap getProperties() {
		return properties;
	}

	public void setProperties(SubNodePropertyMap properties) {
		this.properties = properties;
	}

	public HashMap<String, AccessControl> getAc() {
		return ac;
	}

	public void setAc(HashMap<String, AccessControl> ac) {
		this.ac = ac;
	}
}
