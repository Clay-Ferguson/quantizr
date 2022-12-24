package quanta.request;

import quanta.request.base.RequestBase;

public class LinkNodesRequest extends RequestBase {
	private String sourceNodeId;
	private String targetNodeId;
	private String name;
	private String type; // forward, bidirectional

	public String getSourceNodeId() {
		return sourceNodeId;
	}

	public void setSourceNodeId(String sourceNodeId) {
		this.sourceNodeId = sourceNodeId;
	}

	public String getTargetNodeId() {
		return targetNodeId;
	}

	public void setTargetNodeId(String targetNodeId) {
		this.targetNodeId = targetNodeId;
	}

	public String getType() {
		return type;
	}

	public void setType(String type) {
		this.type = type;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}
}
