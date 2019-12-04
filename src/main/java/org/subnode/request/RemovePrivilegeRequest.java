package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class RemovePrivilegeRequest extends RequestBase {

	private String nodeId;
	private String principalNodeId;

	/* for now only 'public' is the only option we support */
	private String privilege;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getPrincipalNodeId() {
		return principalNodeId;
	}

	public void setPrincipalNodeId(String principalNodeId) {
		this.principalNodeId = principalNodeId;
	}

	public String getPrivilege() {
		return privilege;
	}

	public void setPrivilege(String privilege) {
		this.privilege = privilege;
	}
}
