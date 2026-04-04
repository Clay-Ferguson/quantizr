
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class ImportJsonRequest extends RequestBase {
	private String nodeId;

	// if JSON structure is of known type put it here, for example "toc" for (Table of Contents)
	private String type;

	public ImportJsonRequest() {}

	public String getNodeId() {
		return this.nodeId;
	}

	public void setNodeId(final String nodeId) {
		this.nodeId = nodeId;
	}

	public String getType() {
		return type;
	}

	public void setType(String type) {
		this.type = type;
	}
}
