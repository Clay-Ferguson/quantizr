package quanta.request;

import quanta.request.base.RequestBase;

public class SelectAllNodesRequest extends RequestBase {
	private String parentNodeId;

	public String getParentNodeId() {
		return parentNodeId;
	}

	public void setParentNodeId(String parentNodeId) {
		this.parentNodeId = parentNodeId;
	}
}
