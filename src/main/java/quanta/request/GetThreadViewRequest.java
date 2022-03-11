package quanta.request;

import quanta.request.base.RequestBase;

public class GetThreadViewRequest extends RequestBase {
	private String nodeId;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}
}
