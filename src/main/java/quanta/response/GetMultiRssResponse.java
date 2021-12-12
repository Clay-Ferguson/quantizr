package quanta.response;

import quanta.model.client.RssFeed;
// import org.json.JSONObject;
import quanta.response.base.ResponseBase;

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
