package quanta.request;

import quanta.request.base.RequestBase;

public class GetThreadViewRequest extends RequestBase {
	private String nodeId;
	private boolean loadOthers;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public boolean isLoadOthers() {
		return loadOthers;
	}

	public void setLoadOthers(boolean loadOthers) {
		this.loadOthers = loadOthers;
	}
}
