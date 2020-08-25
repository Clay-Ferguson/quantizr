package org.subnode.mongo;

import org.subnode.model.client.NodeProp;
import org.subnode.model.client.PrincipalName;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.Const;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/* We should make this object accessible from thread-local, so we can eliminate the 100s of places in the code
where we pass this value from function to function endlessly */
public class MongoSession {
	private static final Logger log = LoggerFactory.getLogger(SubNode.class);

	private String user;
	private SubNode userNode;

	// tiny bit of a hack to detect and avoid recursion in the saveSession
	// Since it's very simple and reliable I'm going with this.
	public boolean saving = false;

	private MongoSession() {
	}

	public static MongoSession createFromUser(String user) {
		MongoSession session = new MongoSession();
		session.setUser(user);
		return session;
	}

	public static MongoSession createFromNode(SubNode userNode) {
		MongoSession session = new MongoSession();
		session.setUserNode(userNode);
		return session;
	}

	public boolean isAdmin() {
		return PrincipalName.ADMIN.s().equals(user);
	}

	public boolean isAnon() {
		return PrincipalName.ANON.s().equals(user);
	}

	public String getUser() {
		return user;
	}

	public void setUser(String user) {
		this.user = user;
	}

	public SubNode getUserNode() {
		if (isAnon()) {
			log.debug("Attempted to get UserNode on anonymous session. This is almost always a bug/unintentional");
		}
		return userNode;
	}

	public int getMaxUploadSize() {
		if (userNode == null) {
			return Const.DEFAULT_USER_QUOTA;
		}
		long ret = userNode.getIntProp(NodeProp.BIN_QUOTA.s());
		if (ret == 0) {
			return Const.DEFAULT_USER_QUOTA;
		}
		return (int)ret;
	}

	public void setUserNode(SubNode userNode) {
		this.userNode = userNode;
	}
}
