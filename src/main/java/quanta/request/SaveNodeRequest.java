package quanta.request;

import quanta.model.NodeInfo;
import quanta.request.base.RequestBase;

public class SaveNodeRequest extends RequestBase {

	private NodeInfo node;

	public NodeInfo getNode() {
		return node;
	}

	public void setNode(NodeInfo node) {
		this.node = node;
	}
}
