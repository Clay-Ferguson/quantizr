package org.subnode.mongo.model;

import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import com.fasterxml.jackson.annotation.JsonGetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.PersistenceConstructor;
import org.springframework.data.annotation.Transient;
import org.springframework.data.annotation.TypeAlias;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.MongoAuth;
import org.subnode.util.ExUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.Util;
import org.subnode.util.XString;

/**
 * Node paths are like:
 * 
 * /id1/id2/id2
 * 
 * Any nodes that are 'named' can have friendly names right in the path in leu of any or all IDs.
 * Requirement for a successful insert is merely that the parent must exist.
 * 
 * Forward slash delimited ids.
 * 
 * Basic path strategy:
 * 
 * https://docs.mongodb.com/manual/applications/data-models-tree-structures/
 * 
 * Node ordering of child nodes is done via 'ordinal' which is child position index.
 * 
 * todo-2: One enhancement here would be to let all the 'setter' methods check to see if it is
 * genuinely CHANGING the value as opposed to keeping same value, and in that case avoid the call to
 * MongoSession.dirty(this);
 * 
 * todo-2: Also similar to above note, a 'dirty' flag right inside this object would be good, to set
 * so that even direct calls to api.save(node) would bypass any actual saving if the object is known
 * to not be dirty. (Don't forget to default to 'dirty==true' for all new objects created, but not
 * ones loaded from DB. Be carful with this! This would be a very LATE STAGE optimization.)
 * 
 * todo-p0: should all @JsonIgnores in here also be @Transient ?
 */
@Document(collection = "nodes")
@TypeAlias("n1")
@JsonInclude(Include.NON_NULL)
@JsonPropertyOrder({SubNode.FIELD_PATH, SubNode.FIELD_CONTENT, SubNode.FIELD_NAME, SubNode.FIELD_ID,
		SubNode.FIELD_MAX_CHILD_ORDINAL, SubNode.FIELD_ORDINAL, SubNode.FIELD_OWNER, SubNode.FIELD_CREATE_TIME,
		SubNode.FIELD_MODIFY_TIME, SubNode.FIELD_AC, SubNode.FIELD_PROPERTIES})
public class SubNode {
	private static final Logger log = LoggerFactory.getLogger(SubNode.class);
	public static final String FIELD_ID = "_id";

	@Id
	@Field(FIELD_ID)
	private ObjectId id;

	public static final String FIELD_ORDINAL = "ord";
	@Field(FIELD_ORDINAL)
	private Long ordinal;

	public static final String FIELD_MAX_CHILD_ORDINAL = "mco";
	@Field(FIELD_MAX_CHILD_ORDINAL)
	private Long maxChildOrdinal;

	public static final String FIELD_PATH = "pth";
	@Field(FIELD_PATH)
	private String path;

	public static final String FIELD_TYPE = "typ";
	@Field(FIELD_TYPE)
	private String type;

	public static final String FIELD_CONTENT = "cont";
	@Field(FIELD_CONTENT)
	private String content;

	public static final String FIELD_NAME = "name";
	@Field(FIELD_NAME)
	private String name;

	public static final String FIELD_OWNER = "own";
	@Field(FIELD_OWNER)
	private ObjectId owner;

	public static final String FIELD_CREATE_TIME = "ctm";
	@Field(FIELD_CREATE_TIME)
	private Date createTime;

	public static final String FIELD_MODIFY_TIME = "mtm";
	@Field(FIELD_MODIFY_TIME)
	private Date modifyTime;

	public static final String FIELD_PROPERTIES = "prp";
	@Field(FIELD_PROPERTIES)
	private SubNodePropertyMap properties;

	@Transient
	@JsonIgnore
	private Object propLock = new Object();

	/*
	 * ACL=Access Control List
	 * 
	 * Keys are userNodeIds, and values is a comma delimited list of any of PrivilegeType.java values.
	 * However in addition to userNodeIds identifying users the additional key of "public" is allowed as
	 * a key which indicates privileges granted to everyone (the entire public)
	 */
	public static final String FIELD_AC = "ac";
	@Field(FIELD_AC)
	private HashMap<String, AccessControl> ac;

	@Transient
	@JsonIgnore
	private Object acLock = new Object();

	public static final String[] ALL_FIELDS = { //
			SubNode.FIELD_PATH, //
			SubNode.FIELD_TYPE, //
			SubNode.FIELD_CONTENT, //
			SubNode.FIELD_NAME, //
			SubNode.FIELD_ID, //
			SubNode.FIELD_MAX_CHILD_ORDINAL, //
			SubNode.FIELD_ORDINAL, //
			SubNode.FIELD_OWNER, //
			SubNode.FIELD_CREATE_TIME, //
			SubNode.FIELD_MODIFY_TIME, //
			SubNode.FIELD_AC, //
			SubNode.FIELD_PROPERTIES};

	private boolean disableParentCheck;

	@Transient
	@JsonIgnore
	private int contentLength;

	@PersistenceConstructor
	public SubNode() {
		/*
		 * WARNING: Do NOT initialize times (mod time or create time) in here this constructor gets called
		 * any time the persistence engine loads a node!!!!
		 */
	}

	public SubNode(ObjectId owner, String path, String type, Long ordinal) {
		this.owner = owner;
		this.type = type;
		this.ordinal = ordinal;

		// always user setter, because we are taking a hash of this
		setPath(path);

		Date now = Calendar.getInstance().getTime();
		setModifyTime(now);
		setCreateTime(now);
	}

	// we don't annotate this because we have a custom getter.
	// @JsonProperty(FIELD_ID)
	public ObjectId getId() {
		return id;
	}

	@Transient
	@JsonIgnore
	public String getIdStr() {
		return getId() != null ? getId().toHexString() : null;
	}

	/* Auth: Anyone can write the id as there's no pre-existing id */
	@JsonProperty(FIELD_ID)
	public void setId(ObjectId id) {
		// IDs are allowed to be set to null and ImportArchiveBase does this to force nodes to get saved
		// as a new document when they're being imported.
		if (id != null && this.id != null && !this.id.equals(id)) {
			throw new RuntimeException("Node IDs are immutable.");
		}
		this.id = id;
	}

	@JsonGetter(FIELD_ID)
	public String jsonId() {
		return id != null ? id.toHexString() : null;
	}

	@JsonProperty(FIELD_PATH)
	public String getPath() {
		return path;
	}

	@Transient
	@JsonIgnore
	public String getParentPath() {
		if (getPath() == null)
			return null;
		return XString.truncateAfterLast(getPath(), "/");
	}

	@Transient
	@JsonIgnore
	public String getLastPathPart() {
		if (getPath() == null)
			return null;
		return XString.parseAfterLast(getPath(), "/");
	}

	/*
	 * Auth: As long as the current user owns this node they can set it's path to any path, but only
	 * when the save is done is the final validation done
	 */
	@JsonProperty(FIELD_PATH)
	public void setPath(String path) {
		if (Util.equalObjs(path, this.path))
			return;

		MongoAuth.inst.ownerAuthByThread(this);
		ThreadLocals.dirty(this);
		this.path = path;

		// NOTE: We CANNOT update the cache here, because all the validation for a node
		// is done and MongoEventListener, so this node is currently "untrusted" with it's new path.
	}

	@JsonProperty(FIELD_ORDINAL)
	public Long getOrdinal() {
		return ordinal;
	}

	@JsonProperty(FIELD_ORDINAL)
	public void setOrdinal(Long ordinal) {
		if (Util.equalObjs(ordinal, this.ordinal))
			return;
		ThreadLocals.dirty(this);
		this.ordinal = ordinal;
	}

	@JsonProperty(FIELD_MAX_CHILD_ORDINAL)
	public Long getMaxChildOrdinal() {
		return maxChildOrdinal;
	}

	/*
	 * todo-2: review that this maxordinal is the best pattern/design, and also need to review that it's
	 * always maintained, and even maybe create an admin option i can run that forcably updates all
	 * these values based on current db content
	 */
	@JsonProperty(FIELD_MAX_CHILD_ORDINAL)
	public void setMaxChildOrdinal(Long maxChildOrdinal) {
		if (Util.equalObjs(maxChildOrdinal, this.maxChildOrdinal))
			return;
		/*
		 * todo-2: what about logic that says if this node IS already persisted, and we are not actually
		 * changing the value here, we can bypass setting this 'dirty' flag? I probably have this
		 * performance/optimization on my todo list but i'm putting this note here just in case
		 */
		ThreadLocals.dirty(this);
		this.maxChildOrdinal = maxChildOrdinal;
	}

	// we don't annotate this because we have a custom getter
	// @JsonProperty(FIELD_OWNER)
	public ObjectId getOwner() {
		return owner;
	}

	@JsonProperty(FIELD_OWNER)
	public void setOwner(ObjectId owner) {
		if (Util.equalObjs(owner, this.owner))
			return;
		ThreadLocals.dirty(this);
		this.owner = owner;
	}

	@JsonGetter(FIELD_OWNER)
	public String jsonOwner() {
		return owner != null ? owner.toHexString() : null;
	}

	@JsonProperty(FIELD_CREATE_TIME)
	public Date getCreateTime() {
		return createTime;
	}

	@JsonProperty(FIELD_CREATE_TIME)
	public void setCreateTime(Date createTime) {
		ThreadLocals.dirty(this);
		this.createTime = createTime;
	}

	@JsonProperty(FIELD_MODIFY_TIME)
	public Date getModifyTime() {
		return modifyTime;
	}

	@JsonProperty(FIELD_MODIFY_TIME)
	public void setModifyTime(Date modifyTime) {
		ThreadLocals.dirty(this);
		this.modifyTime = modifyTime;
	}

	public void touch() {
		setModifyTime(Calendar.getInstance().getTime());
	}

	@JsonProperty(FIELD_AC)
	public HashMap<String, AccessControl> getAc() {
		synchronized (acLock) {
			return ac;
		}
	}

	@JsonIgnore
	public HashMap<String, AccessControl> safeGetAc() {
		synchronized (acLock) {
			if (ac == null) {
				ac = new HashMap<>();
			}
			return ac;
		}
	}

	@JsonProperty(FIELD_AC)
	public void setAc(HashMap<String, AccessControl> ac) {
		ThreadLocals.dirty(this);
		synchronized (acLock) {
			this.ac = ac;
		}
	}

	public void clearSecretProperties() {
		synchronized (propLock) {
			if (properties != null) {
				properties.remove(NodeProp.CRYPTO_KEY_PRIVATE.s());
				properties.remove(NodeProp.EMAIL.s());
				properties.remove(NodeProp.CODE.s());
				properties.remove(NodeProp.ENC_KEY.s());
				properties.remove(NodeProp.PWD_HASH.s());
			}
		}
	}

	@JsonProperty(FIELD_PROPERTIES)
	public SubNodePropertyMap getProperties() {
		synchronized (propLock) {
			return properties;
		}
	}

	@JsonProperty(FIELD_PROPERTIES)
	public void setProperties(SubNodePropertyMap properties) {
		ThreadLocals.dirty(this);
		synchronized (propLock) {
			this.properties = properties;
		}
	}

	@JsonIgnore
	public boolean setProp(String key, Object val) {
		ThreadLocals.dirty(this);
		synchronized (propLock) {
			boolean changed = false;
			if (val == null) {
				changed = properties().containsKey(key);
				properties().remove(key);
			} else {
				SubNodePropVal curVal = properties().get(key);
				changed = curVal == null || !val.equals(curVal.getValue());
				properties().put(key, new SubNodePropVal(val));
			}
			return changed;
		}
	}

	@JsonIgnore
	public void deleteProp(String key) {
		ThreadLocals.dirty(this);
		synchronized (propLock) {
			properties().remove(key);
		}
	}

	@Transient
	@JsonIgnore
	public String getStrProp(NodeProp prop) {
		return getStrProp(prop.s());
	}

	@JsonIgnore
	public String getStrProp(String key) {
		try {
			synchronized (propLock) {
				SubNodePropVal v = properties().get(key);
				if (v == null || v.getValue() == null)
					return null;

				return v.getValue().toString();
			}
		} catch (Exception e) {
			ExUtil.error(log, "failed to get String from key: " + key, e);
			return null;
		}
	}

	@JsonIgnore
	public Long getIntProp(String key) {
		try {
			synchronized (propLock) {
				SubNodePropVal v = properties().get(key);
				if (v == null || v.getValue() == null)
					return 0L;
				Object val = v.getValue();

				if (val instanceof Integer) {
					return Long.valueOf((Integer) val);
				}

				// todo-2: When saving from client the values are always sent as strings, and
				// this is a workaround until that changes.
				if (val instanceof String) {
					if (((String) val).length() == 0) {
						return 0L;
					}
					return Long.parseLong((String) val);
				}
				return (Long) v.getValue();
			}
		} catch (Exception e) {
			ExUtil.error(log, "failed to get Long from key: " + key, e);
			return null;
		}
	}

	@JsonIgnore
	public Date getDateProp(String key) {
		try {
			synchronized (propLock) {
				SubNodePropVal v = properties().get(key);
				if (v == null || v.getValue() == null)
					return null;
				return (Date) v.getValue();
			}
		} catch (Exception e) {
			return null;
		}
	}

	@JsonIgnore
	public Double getFloatProp(String key) {
		try {
			synchronized (propLock) {
				SubNodePropVal v = properties().get(key);
				if (v == null || v.getValue() == null)
					return 0.0;
				return (Double) v.getValue();
			}
		} catch (Exception e) {
			ExUtil.error(log, "failed to get Float from key: " + key, e);
			return null;
		}
	}

	@JsonIgnore
	public Boolean getBooleanProp(String key) {
		try {
			synchronized (propLock) {
				SubNodePropVal v = properties().get(key);
				if (v == null || v.getValue() == null)
					return false;

				// Our current property editor only knows how to save strings, so we just cope
				// with that here, but eventually we will have
				// typesafety and types even in the editor.
				if (v.getValue() instanceof String) {
					String s = ((String) v.getValue()).toLowerCase();
					// detect true or 1.
					return s.contains("t") || s.contains("1");
				}
				return (Boolean) v.getValue();
			}
		} catch (Exception e) {
			ExUtil.error(log, "failed to get Boolean from key: " + key, e);
			return null;
		}
	}

	@JsonIgnore
	private SubNodePropertyMap properties() {
		synchronized (propLock) {
			if (properties == null) {
				properties = new SubNodePropertyMap();
			}
			return properties;
		}
	}

	@JsonIgnore
	public boolean isType(NodeType type) {
		return type.s().equals(this.type);
	}

	@JsonIgnore
	public boolean hasProperty(NodeProp prop) {
		synchronized (propLock) {
			return properties != null && properties.containsKey(prop.s());
		}
	}

	@JsonProperty(FIELD_TYPE)
	public String getType() {
		return type;
	}

	@JsonProperty(FIELD_TYPE)
	public void setType(String type) {
		if (Util.equalObjs(type, this.type))
			return;
		ThreadLocals.dirty(this);
		this.type = type;
	}

	@JsonProperty(FIELD_NAME)
	public String getName() {
		return name;
	}

	@JsonProperty(FIELD_NAME)
	public void setName(String name) {
		if (Util.equalObjs(name, this.name))
			return;
		ThreadLocals.dirty(this);
		this.name = name;
	}

	@JsonProperty(FIELD_CONTENT)
	public String getContent() {
		return content;
	}

	@JsonProperty(FIELD_CONTENT)
	public void setContent(String content) {
		if (Util.equalObjs(content, this.content))
			return;
		ThreadLocals.dirty(this);
		this.content = content;
	}

	@Transient
	@JsonIgnore
	public boolean isDisableParentCheck() {
		return disableParentCheck;
	}

	@Transient
	@JsonIgnore
	public void setDisableParentCheck(boolean disableParentCheck) {
		this.disableParentCheck = disableParentCheck;
	}

	public void addProperties(SubNodePropertyMap properties) {
		ThreadLocals.dirty(this);
		synchronized (propLock) {
			properties().putAll(properties);
		}
	}

	public int getContentLength() {
		return contentLength;
	}

	public void setContentLength(int contentLength) {
		this.contentLength = contentLength;
	}
}
