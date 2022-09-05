package quanta.response;

import java.util.List;

import quanta.model.NodeInfo;
import quanta.response.base.ResponseBase;

public class RenderDocumentResponse extends ResponseBase {
	private List<NodeInfo> searchResults;

	public List<NodeInfo> getSearchResults() {
		return searchResults;
	}

	public void setSearchResults(List<NodeInfo> searchResults) {
		this.searchResults = searchResults;
	}
}
