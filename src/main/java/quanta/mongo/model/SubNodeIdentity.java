package quanta.mongo.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public class SubNodeIdentity {
	public static final String FIELD_ID = "_id";

	@JsonProperty(FIELD_ID)
	private String id;

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}
}
