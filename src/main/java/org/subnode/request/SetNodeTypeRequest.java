package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class SetNodeTypeRequest extends RequestBase {
	private String nodeId;
	private String type;

	public String getNodeId() {
		return nodeId;
	}

	public String getType() {
		return type;
	}

	public void setType(String type) {
		this.type = type;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}
}
