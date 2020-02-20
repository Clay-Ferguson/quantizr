package org.subnode.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

/**
 * Represents a privilege name
 *
 */
@JsonInclude(Include.NON_NULL)
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
