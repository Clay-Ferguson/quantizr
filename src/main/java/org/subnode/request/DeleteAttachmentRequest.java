package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class DeleteAttachmentRequest extends RequestBase {
	private String nodeId;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}
}
