
package quanta.rest.request;

import quanta.model.client.SearchDefinition;
import quanta.rest.request.base.RequestBase;

public class NodeSearchRequest extends RequestBase {
	private SearchDefinition searchDefinition;
	/* Can be 'curNode' (default, null) or 'allNodes' */
	private String searchRootOption;
	/* Zero offset page number. First page is zero */
	private int page;

	/* can be node id or path. server interprets correctly no matter which */
	private String nodeId;

	// special definition name which gives the server a hint about what kind of search this is
	private String view;

	private String searchType;
	private String timeRangeType;

	// Admin can set this, and it will delete all matches to the search results
	private boolean deleteMatches;

	public String getSearchRootOption() {
		return this.searchRootOption;
	}

	public int getPage() {
		return this.page;
	}

	public String getNodeId() {
		return this.nodeId;
	}

	public String getView() {
		return this.view;
	}

	public String getSearchType() {
		return this.searchType;
	}

	public String getTimeRangeType() {
		return this.timeRangeType;
	}

	public boolean isDeleteMatches() {
		return this.deleteMatches;
	}

	public void setSearchRootOption(final String searchRootOption) {
		this.searchRootOption = searchRootOption;
	}

	public void setPage(final int page) {
		this.page = page;
	}

	public void setNodeId(final String nodeId) {
		this.nodeId = nodeId;
	}

	public void setView(final String view) {
		this.view = view;
	}

	public void setSearchType(final String searchType) {
		this.searchType = searchType;
	}

	public void setTimeRangeType(final String timeRangeType) {
		this.timeRangeType = timeRangeType;
	}

	public void setDeleteMatches(final boolean deleteMatches) {
		this.deleteMatches = deleteMatches;
	}

	public SearchDefinition getSearchDefinition() {
		return searchDefinition;
	}

	public void setSearchDefinition(SearchDefinition searchDefinition) {
		this.searchDefinition = searchDefinition;
	}

	public NodeSearchRequest() {}
}
