package quanta.request;

import java.util.List;

import quanta.request.base.RequestBase;

public class JoinNodesRequest extends RequestBase {
	private List<String> nodeIds;

	public List<String> getNodeIds() {
		return nodeIds;
	}

	public void setNodeIds(List<String> nodeIds) {
		this.nodeIds = nodeIds;
	}
}
