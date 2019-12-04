package org.subnode.mongo.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.TypeAlias;

/* This was mainly an experiment to see how inheritance can with with SubNode class to create specialized node types, and this
 * approach is not being used much but could be used in lots of places in the code.
 */
@TypeAlias("usrPref")
public class UserPreferencesNode extends SubNode {
	private String userPrefString;

	public UserPreferencesNode(ObjectId owner, String path, String type) {
		super(owner, path, type, null);
	}

	public String getUserPrefString() {
		return userPrefString;
	}

	public void setUserPrefString(String userPrefString) {
		this.userPrefString = userPrefString;
	}
}
