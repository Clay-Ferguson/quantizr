
package quanta.request;

import quanta.model.NodeInfo;
import quanta.request.base.RequestBase;

public class SaveNodeRequest extends RequestBase {
	private NodeInfo node;

	public NodeInfo getNode() {
		return this.node;
	}

	public void setNode(final NodeInfo node) {
		this.node = node;
	}

	public SaveNodeRequest() {}
}
