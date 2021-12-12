package quanta.response;

import java.util.LinkedList;
import quanta.model.BreadcrumbInfo;
import quanta.model.NodeInfo;
import quanta.response.base.ResponseBase;

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
}
