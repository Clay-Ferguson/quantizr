package quanta.response;

import quanta.model.NodeInfo;
import quanta.response.base.ResponseBase;

public class InitNodeEditResponse extends ResponseBase {
	private NodeInfo nodeInfo;

	public NodeInfo getNodeInfo() {
		return nodeInfo;
	}

	public void setNodeInfo(NodeInfo nodeInfo) {
		this.nodeInfo = nodeInfo;
	}
}
