package quanta.request;

import quanta.request.base.RequestBase;

public class SubGraphHashRequest extends RequestBase {

	private boolean recursive;
	private String nodeId;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public boolean isRecursive() {
		return recursive;
	}

	public void setRecursive(boolean recursive) {
		this.recursive = recursive;
	}
}
