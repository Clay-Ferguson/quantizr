
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class SetExpandedRequest extends RequestBase {
	private String nodeId;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public SetExpandedRequest() {}
}
