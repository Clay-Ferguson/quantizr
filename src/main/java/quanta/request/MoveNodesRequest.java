package quanta.request;

import java.util.List;

import quanta.request.base.RequestBase;

public class MoveNodesRequest extends RequestBase {
	/* parent under which the nodes will be moved */
	private String targetNodeId;

	private List<String> nodeIds;

	private String location;

	public List<String> getNodeIds() {
		return nodeIds;
	}

	public void setNodeIds(List<String> nodeIds) {
		this.nodeIds = nodeIds;
	}

	public String getTargetNodeId() {
		return targetNodeId;
	}

	public void setTargetNodeId(String targetNodeId) {
		this.targetNodeId = targetNodeId;
	}

	// public String getTargetChildId() {
	// 	return targetChildId;
	// }

	// public void setTargetChildId(String targetChildId) {
	// 	this.targetChildId = targetChildId;
	// }

	public String getLocation() {
		return location;
	}

	public void setLocation(String location) {
		this.location = location;
	}
}
