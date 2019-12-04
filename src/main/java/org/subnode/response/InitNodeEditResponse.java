package org.subnode.response;

import org.subnode.model.NodeInfo;
import org.subnode.response.base.ResponseBase;

public class InitNodeEditResponse extends ResponseBase {
	private NodeInfo nodeInfo;

	public NodeInfo getNodeInfo() {
		return nodeInfo;
	}

	public void setNodeInfo(NodeInfo nodeInfo) {
		this.nodeInfo = nodeInfo;
	}
}
