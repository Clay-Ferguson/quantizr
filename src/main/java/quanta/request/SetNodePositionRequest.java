package quanta.request;

import quanta.request.base.RequestBase;

public class SetNodePositionRequest extends RequestBase {
	// node to be moved (id or path)
	private String nodeId;

	// targetName can be: up, down, top, bottom
	private String targetName;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getTargetName() {
		return targetName;
	}

	public void setTargetName(String targetName) {
		this.targetName = targetName;
	}
}
