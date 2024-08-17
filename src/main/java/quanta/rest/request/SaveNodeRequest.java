
package quanta.rest.request;

import quanta.model.NodeInfo;
import quanta.rest.request.base.RequestBase;

public class SaveNodeRequest extends RequestBase {
	private NodeInfo node;
	private boolean returnInlineChildren;

	public NodeInfo getNode() {
		return this.node;
	}

	public void setNode(final NodeInfo node) {
		this.node = node;
	}

	public boolean isReturnInlineChildren() {
		return returnInlineChildren;
	}

	public void setReturnInlineChildren(boolean returnInlineChildren) {
		this.returnInlineChildren = returnInlineChildren;
	}

	public SaveNodeRequest() {}
}
