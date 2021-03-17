package org.subnode.request;

import java.util.List;

import org.subnode.request.base.RequestBase;

public class JoinNodesRequest extends RequestBase {
	private List<String> nodeIds;

	public List<String> getNodeIds() {
		return nodeIds;
	}

	public void setNodeIds(List<String> nodeIds) {
		this.nodeIds = nodeIds;
	}
}
