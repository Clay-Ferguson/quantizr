package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class FileSearchRequest extends RequestBase {

	private String searchText;
	private boolean reindex;

	/* Node user has selected when running the command */
	private String nodeId;

	public String getSearchText() {
		return searchText;
	}

	public void setSearchText(String searchText) {
		this.searchText = searchText;
	}

	public boolean isReindex() {
		return reindex;
	}

	public void setReindex(boolean reindex) {
		this.reindex = reindex;
	}

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}
}
