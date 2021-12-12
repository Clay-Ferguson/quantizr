package quanta.request;

import quanta.request.base.RequestBase;

public class RenderCalendarRequest extends RequestBase {

	/* can be node id or path. server interprets correctly no matter which */
	private String nodeId;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}
}
