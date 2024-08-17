
package quanta.rest.response;

import quanta.model.NodeInfo;
import quanta.rest.response.base.NodeChanges;
import quanta.rest.response.base.ResponseBase;

public class InsertNodeResponse extends ResponseBase {
	private NodeInfo newNode;
	private NodeChanges nodeChanges;

	public NodeInfo getNewNode() {
		return this.newNode;
	}

	public void setNewNode(final NodeInfo newNode) {
		this.newNode = newNode;
	}

	public NodeChanges getNodeChanges() {
		return nodeChanges;
	}

	public void setNodeChanges(NodeChanges nodeChanges) {
		this.nodeChanges = nodeChanges;
	}

	public InsertNodeResponse() {}
}
