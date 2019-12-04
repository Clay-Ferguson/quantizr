package org.subnode.response;

import org.subnode.response.base.ResponseBase;

public class FileSearchResponse extends ResponseBase {

	private String searchResultNodeId;

	public String getSearchResultNodeId() {
		return searchResultNodeId;
	}

	public void setSearchResultNodeId(String searchResultNodeId) {
		this.searchResultNodeId = searchResultNodeId;
	}
}
