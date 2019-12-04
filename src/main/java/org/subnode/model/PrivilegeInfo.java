package org.subnode.model;

/**
 * Represents a privilege name
 *
 */
public class PrivilegeInfo {
	private String privilegeName;

	public PrivilegeInfo() {
	}
	
	public PrivilegeInfo(String privilegeName) {
		this.privilegeName = privilegeName;
	}
	
	public String getPrivilegeName() {
		return privilegeName;
	}

	public void setPrivilegeName(String privilegeName) {
		this.privilegeName = privilegeName;
	}
}
