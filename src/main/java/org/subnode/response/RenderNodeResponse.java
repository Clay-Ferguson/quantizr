package org.subnode.response;

import org.subnode.model.NodeInfo;
import org.subnode.response.base.ResponseBase;

public class RenderNodeResponse extends ResponseBase {

	/* child ordering flag is set in this node object and is correct */
	private NodeInfo node;

	/*
	 * todo-2: really need to rename this to 'newOffset', because it's used for more than when a
	 * node is found
	 */
	private Integer offsetOfNodeFound;

	/*
	 * This holds the actual number of children on the node, independent of how many at a time the
	 * browser is requesting to see per page, and unrelated to size of 'children' list, on this
	 * object.
	 */
	private boolean endReached;

	/*
	 * under certain situations the rendering request will be pointed to parent node instead and we
	 * send back to the client 'true' here when that happens.
	 */
	private boolean displayedParent;
	
	private String noDataResponse;

	public NodeInfo getNode() {
		return node;
	}

	public void setNode(NodeInfo node) {
		this.node = node;
	}

	public boolean isDisplayedParent() {
		return displayedParent;
	}

	public void setDisplayedParent(boolean displayedParent) {
		this.displayedParent = displayedParent;
	}

	public boolean isEndReached() {
		return endReached;
	}

	public void setEndReached(boolean endReached) {
		this.endReached = endReached;
	}

	public Integer getOffsetOfNodeFound() {
		return offsetOfNodeFound;
	}

	public void setOffsetOfNodeFound(Integer offsetOfNodeFound) {
		this.offsetOfNodeFound = offsetOfNodeFound;
	}

	public String getNoDataResponse() {
		return noDataResponse;
	}

	public void setNoDataResponse(String noDataResponse) {
		this.noDataResponse = noDataResponse;
	}
}
