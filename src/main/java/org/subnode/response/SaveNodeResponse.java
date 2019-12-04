package org.subnode.response;

import org.subnode.model.NodeInfo;
import org.subnode.response.base.ResponseBase;

public class SaveNodeResponse extends ResponseBase {
	private NodeInfo node;

	public NodeInfo getNode() {
		return node;
	}

	public void setNode(NodeInfo node) {
		this.node = node;
	}
}
