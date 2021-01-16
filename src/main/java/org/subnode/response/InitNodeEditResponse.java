package org.subnode.response;

import org.subnode.model.NodeInfo;
import org.subnode.response.base.ResponseBase;

public class InitNodeEditResponse extends ResponseBase {
	private NodeInfo parentInfo;
	private NodeInfo nodeInfo;

	public NodeInfo getNodeInfo() {
		return nodeInfo;
	}

	public void setNodeInfo(NodeInfo nodeInfo) {
		this.nodeInfo = nodeInfo;
	}

	public NodeInfo getParentInfo() {
		return parentInfo;
	}

	public void setParentInfo(NodeInfo parentInfo) {
		this.parentInfo = parentInfo;
	}
}
