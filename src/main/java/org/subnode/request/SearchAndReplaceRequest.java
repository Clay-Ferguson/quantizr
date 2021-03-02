package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class SearchAndReplaceRequest extends RequestBase {

	private boolean recursive;
	private String nodeId;
	private String search;
	private String replace;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public boolean isRecursive() {
		return recursive;
	}

	public void setRecursive(boolean recursive) {
		this.recursive = recursive;
	}

	public String getSearch() {
		return search;
	}

	public void setSearch(String search) {
		this.search = search;
	}

	public String getReplace() {
		return replace;
	}

	public void setReplace(String replace) {
		this.replace = replace;
	}
}
