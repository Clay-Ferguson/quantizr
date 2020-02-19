package org.subnode.response;

import java.util.List;

import org.subnode.model.AccessControlEntryInfo;
import org.subnode.model.NodeInfo;
import org.subnode.response.base.ResponseBase;

public class SaveNodeResponse extends ResponseBase {
	private NodeInfo node;

	/* In cases where the updated node is adding encryption we need to send back all the principleIds 
	(userNodeIds actually) so the client can generate keys for all of them to send back up to allow
	access by these shared users */
	private List<AccessControlEntryInfo> aclEntries;

	public List<AccessControlEntryInfo> getAclEntries() {
		return aclEntries;
	}

	public void setAclEntries(List<AccessControlEntryInfo> aclEntries) {
		this.aclEntries = aclEntries;
	}
	
	public NodeInfo getNode() {
		return node;
	}

	public void setNode(NodeInfo node) {
		this.node = node;
	}
}
