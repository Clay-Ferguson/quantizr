package quanta.request;

import quanta.request.base.RequestBase;

public class UpdateFriendNodeRequest extends RequestBase {

	private String nodeId;
	private String tags;
	
	public String getNodeId() {
		return nodeId;
	}
	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}
	public String getTags() {
		return tags;
	}
	public void setTags(String tags) {
		this.tags = tags;
	}
}
