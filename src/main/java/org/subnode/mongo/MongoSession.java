package org.subnode.mongo;

import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.subnode.model.client.PrincipalName;

public class MongoSession {
	private static final Logger log = LoggerFactory.getLogger(MongoSession.class);

	private String userName;
	private ObjectId userNodeId;

	// tiny bit of a hack to detect and avoid recursion in the saveSession
	// Since it's very simple and reliable I'm going with this.
	public boolean saving = false;

	public MongoSession() {
		userName = PrincipalName.ANON.s();
	}

	public MongoSession(String userName) {
		this.userName = userName;
	}

	public boolean isAdmin() {
		return PrincipalName.ADMIN.s().equals(userName);
	}

	public boolean isAnon() {
		return userName == null || PrincipalName.ANON.s().equals(userName);
	}

	public String getUserName() {
		return userName;
	}

	public void setUserName(String userName) {
		this.userName = userName;
	}

	public ObjectId getUserNodeId() {
		return userNodeId;
	}

	public void setUserNodeId(ObjectId userNodeId) {
		this.userNodeId = userNodeId;
	}
}
