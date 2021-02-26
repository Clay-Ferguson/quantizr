package org.subnode.model;

import java.util.LinkedList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

/**
 * Represents a certain principal and a set of privileges the principal has.
 */
@JsonInclude(Include.NON_NULL)
public class AccessControlInfo {
	private String principalName;
	private String principalNodeId;
	private String avatarVer;
	private List<PrivilegeInfo> privileges;
	private String publicKey;

	public AccessControlInfo() {
	}

	public AccessControlInfo(String principalName, String principalNodeId, String publicKey, String avatarVer) {
		this.principalName = principalName;
		this.principalNodeId = principalNodeId;
		this.publicKey = publicKey;
		this.avatarVer = avatarVer;
	}

	public String getPrincipalName() {
		return principalName;
	}

	public void setPrincipalName(String principalName) {
		this.principalName = principalName;
	}

	public List<PrivilegeInfo> getPrivileges() {
		return privileges;
	}

	public void setPrivileges(List<PrivilegeInfo> privileges) {
		this.privileges = privileges;
	}

	public void addPrivilege(PrivilegeInfo priv) {
		if (privileges == null) {
			privileges = new LinkedList<PrivilegeInfo>();
		}
		privileges.add(priv);
	}

	public String getPrincipalNodeId() {
		return principalNodeId;
	}

	public void setPrincipalNodeId(String principalNodeId) {
		this.principalNodeId = principalNodeId;
	}

	public String getPublicKey() {
		return publicKey;
	}

	public void setPublicKey(String publicKey) {
		this.publicKey = publicKey;
	}

	public String getAvatarVer() {
		return avatarVer;
	}

	public void setAvatarVer(String avatarVer) {
		this.avatarVer = avatarVer;
	}
}
