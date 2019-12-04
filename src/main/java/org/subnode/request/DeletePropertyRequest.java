package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class DeletePropertyRequest extends RequestBase {
	private String nodeId;
	private String propName;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getPropName() {
		return propName;
	}

	public void setPropName(String propName) {
		this.propName = propName;
	}
}
