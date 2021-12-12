package quanta.request;

import quanta.request.base.RequestBase;

public class DeleteFriendRequest extends RequestBase {
	private String userNodeId;

	public String getUserNodeId() {
		return userNodeId;
	}

	public void setUserNodeId(String userNodeId) {
		this.userNodeId = userNodeId;
	}
}
