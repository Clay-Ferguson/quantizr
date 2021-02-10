package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class NodeSearchRequest extends RequestBase {

	/* ascending=asc, descending=desc */
	private String sortDir;

	/* property to sort on */
	private String sortField;

	/* can be node id or path. server interprets correctly no matter which */
	private String nodeId;

	private String searchText;

	private String searchProp;

	//fuzzy means you can get substring searches, where the substring is not on the FIRST characters of a term
	private boolean fuzzy;

	private boolean caseSensitive;

	//special definition name for pre-defined searches like "AllUserSharedNodes", or "AllPublicNodes"
	private String searchDefinition;

	private boolean userSearch;
	private boolean localUserSearch;
	private boolean foreignUserSearch;

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

	public boolean isUserSearch() {
		return userSearch;
	}

	public void setUserSearch(boolean userSearch) {
		this.userSearch = userSearch;
	}

	public boolean isLocalUserSearch() {
		return localUserSearch;
	}

	public void setLocalUserSearch(boolean localUserSearch) {
		this.localUserSearch = localUserSearch;
	}

	public boolean isForeignUserSearch() {
		return foreignUserSearch;
	}

	public void setForeignUserSearch(boolean foreignUserSearch) {
		this.foreignUserSearch = foreignUserSearch;
	}
}
