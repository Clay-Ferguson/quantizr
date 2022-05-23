package quanta.request;

import quanta.request.base.RequestBase;

public class SetUnpublishedRequest extends RequestBase {

	private String nodeId;
	private boolean unpublished;

	public boolean isUnpublished() {
		return unpublished;
	}

	public void setUnpublished(boolean unpublished) {
		this.unpublished = unpublished;
	}

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}
}
