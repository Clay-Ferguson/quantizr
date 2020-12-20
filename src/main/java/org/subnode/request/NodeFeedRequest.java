package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class NodeFeedRequest extends RequestBase {

	/* Note one of the other of these should be non-null, but not both */
	private String nodeId;
	private String feedUserName;
	private String userFilter; // friends | all
	private String serverFilter; // local | federated

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getFeedUserName() {
		return feedUserName;
	}

	public void setFeedUserName(String feedUserName) {
		this.feedUserName = feedUserName;
	}

	public String getUserFilter() {
		return userFilter;
	}

	public void setUserFilter(String userFilter) {
		this.userFilter = userFilter;
	}

	public String getServerFilter() {
		return serverFilter;
	}

	public void setServerFilter(String serverFilter) {
		this.serverFilter = serverFilter;
	}
}
