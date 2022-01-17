package quanta.request;

import java.util.List;

import quanta.request.base.RequestBase;

public class AddPrivilegeRequest extends RequestBase {

	private String nodeId;

	/* for now only 'public' is the only option we support */
	private List<String> privileges;

	private String principal;
	private boolean recursive;

	public String getNodeId() {
		return nodeId;
	}

	public boolean isRecursive() {
		return recursive;
	}

	public void setRecursive(boolean recursive) {
		this.recursive = recursive;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getPrincipal() {
		return principal;
	}

	public void setPrincipal(String principal) {
		this.principal = principal;
	}

	public List<String> getPrivileges() {
		return privileges;
	}

	public void setPrivileges(List<String> privileges) {
		this.privileges = privileges;
	}
}
