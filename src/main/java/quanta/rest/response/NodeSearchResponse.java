
package quanta.rest.response;

import java.util.List;
import quanta.model.NodeInfo;
import quanta.rest.response.base.ResponseBase;

public class NodeSearchResponse extends ResponseBase {
	private List<NodeInfo> searchResults;
	private NodeInfo node;

	public List<NodeInfo> getSearchResults() {
		return this.searchResults;
	}

	public void setSearchResults(final List<NodeInfo> searchResults) {
		this.searchResults = searchResults;
	}

	public NodeInfo getNode() {
		return node;
	}

	public void setNode(NodeInfo node) {
		this.node = node;
	}

	public NodeSearchResponse() {}
}
