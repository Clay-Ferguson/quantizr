package org.subnode.response;

import org.subnode.model.client.RssFeed;
// import org.json.JSONObject;
import org.subnode.response.base.ResponseBase;

public class GetMultiRssResponse extends ResponseBase {
    // JSON of the feed as a string.
    private RssFeed feed;

    public RssFeed getFeed() {
        return feed;
    }

    public void setFeed(RssFeed feed) {
        this.feed = feed;
    }
}
