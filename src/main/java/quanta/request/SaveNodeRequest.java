
package quanta.request;

import quanta.model.NodeInfo;
import quanta.request.base.RequestBase;

public class SaveNodeRequest extends RequestBase {
	private NodeInfo node;
	boolean saveToActPub;

	public NodeInfo getNode() {
		return this.node;
	}

	public boolean isSaveToActPub() {
		return this.saveToActPub;
	}

	public void setNode(final NodeInfo node) {
		this.node = node;
	}

	public void setSaveToActPub(final boolean saveToActPub) {
		this.saveToActPub = saveToActPub;
	}

	public SaveNodeRequest() {}
}
