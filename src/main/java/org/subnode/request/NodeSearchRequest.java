package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class NodeSearchRequest extends RequestBase {

	/* Zero offset page number. First page is zero */
	private int page;

	/* ascending=asc, descending=desc */
	private String sortDir;

	/* property to sort on */
	private String sortField;

	/* can be node id or path. server interprets correctly no matter which */
	private String nodeId;

	private String searchText;

	private String searchProp;

	// fuzzy means you can get substring searches, where the substring is not on the FIRST characters of
	// a term
	private boolean fuzzy;

	private boolean caseSensitive;

	// special definition name which gives the server a hint about what kind of search this is
	private String searchDefinition;

	private String searchType;

	private String timeRangeType;

	private boolean recursive;

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

	public String getSearchProp() {
		return searchProp;
	}

	public void setSearchProp(String searchProp) {
		this.searchProp = searchProp;
	}

	public String getSortDir() {
		return sortDir;
	}

	public void setSortDir(String sortDir) {
		this.sortDir = sortDir;
	}

	public String getSortField() {
		return sortField;
	}

	public void setSortField(String sortField) {
		this.sortField = sortField;
	}

	public boolean getFuzzy() {
		return fuzzy;
	}

	public void setFuzzy(boolean fuzzy) {
		this.fuzzy = fuzzy;
	}

	public boolean getCaseSensitive() {
		return caseSensitive;
	}

	public void setCaseSensitive(boolean caseSensitive) {
		this.caseSensitive = caseSensitive;
	}

	public String getSearchDefinition() {
		return searchDefinition;
	}

	public void setSearchDefinition(String searchDefinition) {
		this.searchDefinition = searchDefinition;
	}

	public String getSearchType() {
		return searchType;
	}

	public void setSearchType(String searchType) {
		this.searchType = searchType;
	}

	public String getTimeRangeType() {
		return timeRangeType;
	}

	public void setTimeRangeType(String timeRangeType) {
		this.timeRangeType = timeRangeType;
	}

	public int getPage() {
		return page;
	}

	public void setPage(int page) {
		this.page = page;
	}

	public boolean isRecursive() {
		return recursive;
	}

	public void setRecursive(boolean recursive) {
		this.recursive = recursive;
	}

}
