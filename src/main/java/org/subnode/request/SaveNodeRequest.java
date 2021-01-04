package org.subnode.request;

import org.subnode.model.NodeInfo;
import org.subnode.request.base.RequestBase;

public class SaveNodeRequest extends RequestBase {

	private NodeInfo node;

	public NodeInfo getNode() {
		return node;
	}

	public void setNode(NodeInfo node) {
		this.node = node;
	}
}
