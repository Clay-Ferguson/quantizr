package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class RenderCalendarRequest extends RequestBase {

	// If true we include ALL nodes, instead of just nodes with DATA property.
	private boolean allNodes;

	/* can be node id or path. server interprets correctly no matter which */
	private String nodeId;

	public boolean isAllNodes() {
		return allNodes;
	}

	public void setAllNodes(boolean allNodes) {
		this.allNodes = allNodes;
	}

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}
}
