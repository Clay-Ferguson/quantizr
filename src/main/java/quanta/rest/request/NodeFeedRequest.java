
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class NodeFeedRequest extends RequestBase {
	// zero offset page of results (page=0 is first page)
	private Integer page;
	private String toUser;
	private Boolean toMe;
	private Boolean fromMe;
	private Boolean fromFriends;
	private Boolean toPublic;
	private String searchText;
	// users can add hashtags to each Friend Node, and those are passed in to filter to show
	// only friends tagged with this tag
	private String friendsTagSearch;
	private Boolean loadFriendsTags;
	private boolean applyAdminBlocks;
	// textual representation of what kind of request is being done.
	private String name;

	public Integer getPage() {
		return this.page;
	}

	public String getToUser() {
		return this.toUser;
	}

	public Boolean getToMe() {
		return this.toMe;
	}

	public Boolean getFromMe() {
		return this.fromMe;
	}

	public Boolean getFromFriends() {
		return this.fromFriends;
	}

	public Boolean getToPublic() {
		return this.toPublic;
	}

	public String getSearchText() {
		return this.searchText;
	}

	public String getFriendsTagSearch() {
		return this.friendsTagSearch;
	}

	public Boolean getLoadFriendsTags() {
		return this.loadFriendsTags;
	}

	public boolean isApplyAdminBlocks() {
		return this.applyAdminBlocks;
	}

	public String getName() {
		return this.name;
	}

	public void setPage(final Integer page) {
		this.page = page;
	}

	public void setToUser(final String toUser) {
		this.toUser = toUser;
	}

	public void setToMe(final Boolean toMe) {
		this.toMe = toMe;
	}

	public void setFromMe(final Boolean fromMe) {
		this.fromMe = fromMe;
	}

	public void setFromFriends(final Boolean fromFriends) {
		this.fromFriends = fromFriends;
	}

	public void setToPublic(final Boolean toPublic) {
		this.toPublic = toPublic;
	}

	public void setSearchText(final String searchText) {
		this.searchText = searchText;
	}

	public void setFriendsTagSearch(final String friendsTagSearch) {
		this.friendsTagSearch = friendsTagSearch;
	}

	public void setLoadFriendsTags(final Boolean loadFriendsTags) {
		this.loadFriendsTags = loadFriendsTags;
	}

	public void setApplyAdminBlocks(final boolean applyAdminBlocks) {
		this.applyAdminBlocks = applyAdminBlocks;
	}

	public void setName(final String name) {
		this.name = name;
	}

	public NodeFeedRequest() {}
}
