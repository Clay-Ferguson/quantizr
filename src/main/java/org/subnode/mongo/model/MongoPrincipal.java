package org.subnode.mongo.model;

import org.bson.types.ObjectId;

/* userNodeId is required. userName is optional 
 * 
 * accessLevels: 
 *    w = read/write
 *    r = readonly
 */
public class MongoPrincipal {
	private ObjectId userNodeId;
	private String userName;
	private String accessLevel;

	public String getUserName() {
		return userName;
	}

	public void setName(String userName) {
		this.userName = userName;
	}

	public String getAccessLevel() {
		return accessLevel;
	}

	public void setAccessLevel(String accessLevel) {
		this.accessLevel = accessLevel;
	}

	public ObjectId getUserNodeId() {
		return userNodeId;
	}

	public void setUserNodeId(ObjectId userNodeId) {
		this.userNodeId = userNodeId;
	}
}
