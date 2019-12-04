package org.subnode.model;

import java.util.LinkedList;
import java.util.List;

/**
 * Represents a certain principle and a set of privileges the principle has.
 */
public class AccessControlEntryInfo {
	private String principalName;
	private String principalNodeId;
	private List<PrivilegeInfo> privileges;
	
	public AccessControlEntryInfo() {
	}

	public AccessControlEntryInfo(String principalName, String principalNodeId) {
		this.principalName = principalName;
		this.principalNodeId = principalNodeId;
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
}
