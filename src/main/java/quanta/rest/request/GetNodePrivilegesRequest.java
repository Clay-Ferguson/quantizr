
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class GetNodePrivilegesRequest extends RequestBase {
	private String nodeId;
	
	public String getNodeId() {
		return this.nodeId;
	}
	
	public void setNodeId(final String nodeId) {
		this.nodeId = nodeId;
	}

	public GetNodePrivilegesRequest() {
	}
}
