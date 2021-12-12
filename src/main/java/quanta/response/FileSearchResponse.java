package quanta.response;

import quanta.response.base.ResponseBase;

public class FileSearchResponse extends ResponseBase {

	private String searchResultNodeId;

	public String getSearchResultNodeId() {
		return searchResultNodeId;
	}

	public void setSearchResultNodeId(String searchResultNodeId) {
		this.searchResultNodeId = searchResultNodeId;
	}
}
