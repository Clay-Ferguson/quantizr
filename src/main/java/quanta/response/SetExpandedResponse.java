
package quanta.response;

import quanta.model.NodeInfo;
import quanta.response.base.ResponseBase;

public class SetExpandedResponse extends ResponseBase {
	private NodeInfo node;

	public NodeInfo getNode() {
		return this.node;
	}

	public void setNode(final NodeInfo node) {
		this.node = node;
	}

	public SetExpandedResponse() {}
}
