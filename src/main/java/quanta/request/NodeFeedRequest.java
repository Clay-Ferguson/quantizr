package quanta.request;

import quanta.request.base.RequestBase;

public class NodeFeedRequest extends RequestBase {

	// zero offset page of results (page=0 is first page)
	private Integer page;

	/* Note one of the other of these should be non-null, but not both */
	private String nodeId;
	private String toUser;

	private Boolean toMe;
	private Boolean myMentions;
	private Boolean fromMe;
	private Boolean fromFriends;
	private Boolean toPublic;
	private Boolean localOnly;
	private Boolean nsfw;

	private String searchText;

	// users can add hashtags to each Friend Node, and those are passed in to filter to show
	// only friends tagged with this tag
	private String friendsTagSearch;
	private Boolean loadFriendsTags;

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

	public Boolean getMyMentions() {
		return myMentions;
	}

	public void setMyMentions(Boolean myMentions) {
		this.myMentions = myMentions;
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

	public String getFriendsTagSearch() {
		return friendsTagSearch;
	}

	public void setFriendsTagSearch(String friendsTagSearch) {
		this.friendsTagSearch = friendsTagSearch;
	}

	public Boolean getLoadFriendsTags() {
		return loadFriendsTags;
	}

	public void setLoadFriendsTags(Boolean loadFriendsTags) {
		this.loadFriendsTags = loadFriendsTags;
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
