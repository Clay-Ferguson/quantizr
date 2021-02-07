package org.subnode.response;

import java.util.HashMap;
import java.util.LinkedList;

import org.subnode.model.BreadcrumbInfo;
import org.subnode.model.NodeInfo;
import org.subnode.response.base.ResponseBase;


public class RenderNodeResponse extends ResponseBase {

	/* child ordering flag is set in this node object and is correct */
	private NodeInfo node;

	/*
	 * This holds the actual number of children on the node, independent of how many at a time the
	 * browser is requesting to see per page, and unrelated to size of 'children' list, on this
	 * object.
	 */
	private boolean endReached;
	
	private String noDataResponse;

	private LinkedList<BreadcrumbInfo> breadcrumbs;

	/* We can optionally update the config any time by populating this. Normally it's left null */
	private HashMap<String, Object> config;

	public NodeInfo getNode() {
		return node;
	}

	public void setNode(NodeInfo node) {
		this.node = node;
	}

	public boolean isEndReached() {
		return endReached;
	}

	public void setEndReached(boolean endReached) {
		this.endReached = endReached;
	}

	public String getNoDataResponse() {
		return noDataResponse;
	}

	public void setNoDataResponse(String noDataResponse) {
		this.noDataResponse = noDataResponse;
	}

	public LinkedList<BreadcrumbInfo> getBreadcrumbs() {
        return breadcrumbs;
    }

    public void setBreadcrumbs(LinkedList<BreadcrumbInfo> breadcrumbs) {
        this.breadcrumbs = breadcrumbs;
    }

	public HashMap<String, Object> getConfig() {
		return config;
	}

	public void setConfig(HashMap<String, Object> config) {
		this.config = config;
	}
}
