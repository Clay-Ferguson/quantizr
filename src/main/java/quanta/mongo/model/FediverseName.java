package quanta.mongo.model;

import static quanta.util.Util.ok;
import java.util.Date;
import com.fasterxml.jackson.annotation.JsonGetter;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.PersistenceConstructor;
import org.springframework.data.annotation.TypeAlias;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

/* We're going to be caching every Fediverse username we encounter for future unspecified purposes */
@Document(collection = "fediNames")
@TypeAlias("fn")
@JsonInclude(Include.NON_NULL)
@JsonPropertyOrder({SubNode.ID, SubNode.NAME, SubNode.CREATE_TIME})
public class FediverseName {
	private static final Logger log = LoggerFactory.getLogger(FediverseName.class);
	
	public static final String FIELD_ID = "_id";

	@Id
	@Field(FIELD_ID)
	private ObjectId id;

	public static final String FIELD_NAME = "name";
	@Field(FIELD_NAME)
	private String name;

	public static final String FIELD_CREATE_TIME = "ctm";
	@Field(FIELD_CREATE_TIME)
	private Date createTime;

	@PersistenceConstructor
	public FediverseName() {
		/*
		 * WARNING: Do NOT initialize times (mod time or create time) in here this constructor gets called
		 * any time the persistence engine loads a node!!!!
		 */
	}

	// we don't annotate this because we have a custom getter.
	// @JsonProperty(FIELD_ID)
	public ObjectId getId() {
		return id;
	}

	@JsonProperty(FIELD_ID)
	public void setId(ObjectId id) {
		this.id = id;
	}

	@JsonGetter(FIELD_ID)
	public String jsonId() {
		return ok(id) ? id.toHexString() : null;
	}

	@JsonProperty(FIELD_CREATE_TIME)
	public Date getCreateTime() {
		return createTime;
	}

	@JsonProperty(FIELD_CREATE_TIME)
	public void setCreateTime(Date createTime) {
		this.createTime = createTime;
	}

	@JsonProperty(FIELD_NAME)
	public String getName() {
		return name;
	}

	@JsonProperty(FIELD_NAME)
	public void setName(String name) {
		this.name = name;
	}
}
