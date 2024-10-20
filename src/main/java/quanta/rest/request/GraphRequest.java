
package quanta.rest.request;

import quanta.model.client.SearchDefinition;
import quanta.rest.request.base.RequestBase;

public class GraphRequest extends RequestBase {
	/* can be node id or path. server interprets correctly no matter which */
	private String nodeId;
	private SearchDefinition searchDefinition;

	public String getNodeId() {
		return this.nodeId;
	}

	public void setNodeId(final String nodeId) {
		this.nodeId = nodeId;
	}

	public SearchDefinition getSearchDefinition() {
		return this.searchDefinition;
	}

	public void setSearchDefinition(final SearchDefinition searchDefinition) {
		this.searchDefinition = searchDefinition;
	}

	public GraphRequest() {}
}
