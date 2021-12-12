package quanta.response;

import quanta.model.NodeInfo;
import quanta.response.base.ResponseBase;

public class InsertNodeResponse extends ResponseBase {
	private NodeInfo newNode;

	public NodeInfo getNewNode() {
		return newNode;
	}

	public void setNewNode(NodeInfo newNode) {
		this.newNode = newNode;
	}
}
