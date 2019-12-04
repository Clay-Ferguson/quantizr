package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class ActivityPubPostRequest extends RequestBase {
	private String nodeId;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeIds(String nodeId) {
		this.nodeId = nodeId;
	}
}
