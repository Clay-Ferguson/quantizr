package quanta.request;

import java.util.List;

import quanta.request.base.RequestBase;

public class AddPrivilegeRequest extends RequestBase {

	private String nodeId;

	/* for now only 'public' is the only option we support */
	private List<String> privileges;

	private String[] principals;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String[] getPrincipals() {
		return principals;
	}

	public void setPrincipals(String[] principals) {
		this.principals = principals;
	}

	public List<String> getPrivileges() {
		return privileges;
	}

	public void setPrivileges(List<String> privileges) {
		this.privileges = privileges;
	}
}
