package quanta.response;

import java.util.List;

import quanta.model.NodeInfo;
import quanta.response.base.ResponseBase;

public class NodeFeedResponse extends ResponseBase {

	private Boolean endReached;

	/* orderablility of children not set in these objects, all will be false */
	private List<NodeInfo> searchResults;

	private List<String> friendHashTags;

	public List<NodeInfo> getSearchResults() {
		return searchResults;
	}

	public void setSearchResults(List<NodeInfo> searchResults) {
		this.searchResults = searchResults;
	}

	public Boolean getEndReached() {
		return endReached;
	}

	public List<String> getFriendHashTags() {
		return friendHashTags;
	}

	public void setFriendHashTags(List<String> friendHashTags) {
		this.friendHashTags = friendHashTags;
	}

	public void setEndReached(Boolean endReached) {
		this.endReached = endReached;
	}
}
