package quanta.request;

import quanta.request.base.RequestBase;

public class NodeFeedRequest extends RequestBase {

	//zero offset page of results (page=0 is first page)
	private Integer page;

	/* Note one of the other of these should be non-null, but not both */
	private String nodeId;
	private String toUser;

	private Boolean toMe;
	private Boolean fromMe;
	private Boolean fromFriends;
	private Boolean toPublic;
	private Boolean localOnly;
	private Boolean nsfw;

	private String searchText;
	private boolean applyAdminBlocks;

	// textual representation of what kind of request is being done.
	private String name;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
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

	public String getSearchText() {
		return searchText;
	}

	public void setSearchText(String searchText) {
		this.searchText = searchText;
	}

	public Boolean getLocalOnly() {
		return localOnly;
	}

	public void setLocalOnly(Boolean localOnly) {
		this.localOnly = localOnly;
	}

	public String getToUser() {
		return toUser;
	}

	public void setToUser(String toUser) {
		this.toUser = toUser;
	}

	public boolean isApplyAdminBlocks() {
		return applyAdminBlocks;
	}

	public void setApplyAdminBlocks(boolean applyAdminBlocks) {
		this.applyAdminBlocks = applyAdminBlocks;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}
}
