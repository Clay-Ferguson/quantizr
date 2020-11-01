package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class GraphRequest extends RequestBase {

	/* can be node id or path. server interprets correctly no matter which */
	private String nodeId;

	// optional, to perform search to build a graphical result of that.
	private String searchText;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getSearchText() {
		return searchText;
	}

	public void setSearchText(String searchText) {
		this.searchText = searchText;
	}
}

