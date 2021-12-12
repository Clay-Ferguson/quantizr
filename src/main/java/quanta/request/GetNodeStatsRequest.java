package quanta.request;

import quanta.request.base.RequestBase;

public class GetNodeStatsRequest extends RequestBase {
    private String nodeId;
    private boolean trending;

    /* True if this will be the trending button on the Feed tab running this for the Feed tab */
    private boolean feed;

    public String getNodeId() {
        return nodeId;
    }

    public void setNodeId(String nodeId) {
        this.nodeId = nodeId;
    }

    public boolean isTrending() {
        return trending;
    }

    public void setTrending(boolean trending) {
        this.trending = trending;
    }

    public boolean isFeed() {
        return feed;
    }

    public void setFeed(boolean feed) {
        this.feed = feed;
    }
}
