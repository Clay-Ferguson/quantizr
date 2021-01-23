package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class NodeFeedRequest extends RequestBase {

	//zero offset page of results (page=0 is first page)
	private Integer page;

	/* Note one of the other of these should be non-null, but not both */
	private String nodeId;
	private String feedUserName;

	private Boolean toMe;
	private Boolean fromMe;
	private Boolean fromFriends;
	private Boolean toPublic;
	private Boolean nsfw;

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

	public Boolean getToMe() {
		return toMe;
	}

	public void setToMe(Boolean toMe) {
		this.toMe = toMe;
	}

	public Boolean getFromMe() {
		return fromMe;
	}

	public void setFromMe(Boolean fromMe) {
		this.fromMe = fromMe;
	}

	public Boolean getToPublic() {
		return toPublic;
	}

	public void setToPublic(Boolean toPublic) {
		this.toPublic = toPublic;
	}

	public Integer getPage() {
		return page;
	}

	public void setPage(Integer page) {
		this.page = page;
	}

	public Boolean getNsfw() {
		return nsfw;
	}

	public void setNsfw(Boolean nsfw) {
		this.nsfw = nsfw;
	}

	public Boolean getFromFriends() {
		return fromFriends;
	}

	public void setFromFriends(Boolean fromFriends) {
		this.fromFriends = fromFriends;
	}
}
