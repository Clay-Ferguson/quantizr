package org.subnode.response;

import org.subnode.model.NodeInfo;
import org.subnode.response.base.ResponseBase;

public class InsertNodeResponse extends ResponseBase {
	private NodeInfo newNode;

	public NodeInfo getNewNode() {
		return newNode;
	}

	public void setNewNode(NodeInfo newNode) {
		this.newNode = newNode;
	}
}
