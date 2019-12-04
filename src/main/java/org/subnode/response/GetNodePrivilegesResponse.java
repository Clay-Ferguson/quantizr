package org.subnode.response;

import java.util.List;

import org.subnode.model.AccessControlEntryInfo;
import org.subnode.response.base.ResponseBase;

public class GetNodePrivilegesResponse extends ResponseBase {
	private List<AccessControlEntryInfo> aclEntries;
	private List<String> owners;

	/*
	 * This value will match (and come from) the property named 'publicAppend' on the nodes which is
	 * an optional property and if not present this boolean will be 'false'
	 */
	private boolean publicAppend;

	public List<AccessControlEntryInfo> getAclEntries() {
		return aclEntries;
	}

	public void setAclEntries(List<AccessControlEntryInfo> aclEntries) {
		this.aclEntries = aclEntries;
	}

	public List<String> getOwners() {
		return owners;
	}

	public void setOwners(List<String> owners) {
		this.owners = owners;
	}

	public boolean isPublicAppend() {
		return publicAppend;
	}

	public void setPublicAppend(boolean publicAppend) {
		this.publicAppend = publicAppend;
	}

}
