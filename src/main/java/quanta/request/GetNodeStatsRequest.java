package quanta.request;

import quanta.request.base.RequestBase;

public class GetNodeStatsRequest extends RequestBase {
    private String nodeId;
    private boolean trending;
    private boolean signatureVerify;
    
    /* True if this will be the trending button on the Feed tab running this for the Feed tab */
    private boolean feed;

    private boolean getWords;
    private boolean getMentions;
    private boolean getTags;

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

    public boolean isGetWords() {
        return getWords;
    }

    public void setGetWords(boolean getWords) {
        this.getWords = getWords;
    }

    public boolean isGetMentions() {
        return getMentions;
    }

    public void setGetMentions(boolean getMentions) {
        this.getMentions = getMentions;
    }

    public boolean isGetTags() {
        return getTags;
    }

    public void setGetTags(boolean getTags) {
        this.getTags = getTags;
    }

    public boolean isSignatureVerify() {
        return signatureVerify;
    }

    public void setSignatureVerify(boolean signatureVerify) {
        this.signatureVerify = signatureVerify;
    }
}
