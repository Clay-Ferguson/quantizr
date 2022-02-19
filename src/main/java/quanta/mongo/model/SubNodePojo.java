package quanta.mongo.model;

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
 * Pure Pojo equivalent of SubNode.java, so we can do serialization to/from JSON without MongoDB
 * trying to get involved (no PersistenceConstructor issues)
 */
@JsonInclude(Include.NON_NULL)
@JsonPropertyOrder({SubNode.PATH, SubNode.CONTENT, SubNode.NAME, SubNode.ID, SubNode.ORDINAL, SubNode.OWNER, SubNode.CREATE_TIME,
		SubNode.MODIFY_TIME, SubNode.AC, SubNode.PROPS})
public class SubNodePojo {
	private static final Logger log = LoggerFactory.getLogger(SubNodePojo.class);

	@JsonProperty(SubNode.ID)
	private ObjectId id;

	@JsonProperty(SubNode.ORDINAL)
	private Long ordinal;

	@JsonProperty(SubNode.PATH)
	private String path;

	@JsonProperty(SubNode.TYPE)
	private String type;

	@JsonProperty(SubNode.CONTENT)
	private String content;

	@JsonProperty(SubNode.NAME)
	private String name;

	@JsonProperty(SubNode.OWNER)
	private ObjectId owner;

	@JsonProperty(SubNode.CREATE_TIME)
	private Date createTime;

	@JsonProperty(SubNode.MODIFY_TIME)
	private Date modifyTime;

	@JsonProperty(SubNode.PROPS)
	private HashMap<String, Object> props;

	@JsonProperty(SubNode.AC)
	private HashMap<String, AccessControl> ac;

	public SubNodePojo() {}

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

	public HashMap<String, Object> getProps() {
		return props;
	}

	public void setProps(HashMap<String, Object> props) {
		this.props = props;
	}

	public HashMap<String, AccessControl> getAc() {
		return ac;
	}

	public void setAc(HashMap<String, AccessControl> ac) {
		this.ac = ac;
	}
}
