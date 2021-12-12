package quanta.response;

import java.util.List;

import quanta.model.AccessControlInfo;
import quanta.model.NodeInfo;
import quanta.response.base.ResponseBase;

public class SaveNodeResponse extends ResponseBase {
	private NodeInfo node;

	/* In cases where the updated node is adding encryption we need to send back all the principalIds 
	(userNodeIds actually) so the client can generate keys for all of them to send back up to allow
	access by these shared users. Unless the node is being encrypted these aclEntries will be null */
	private List<AccessControlInfo> aclEntries;

	public List<AccessControlInfo> getAclEntries() {
		return aclEntries;
	}

	public void setAclEntries(List<AccessControlInfo> aclEntries) {
		this.aclEntries = aclEntries;
	}
	
	public NodeInfo getNode() {
		return node;
	}

	public void setNode(NodeInfo node) {
		this.node = node;
	}
}
