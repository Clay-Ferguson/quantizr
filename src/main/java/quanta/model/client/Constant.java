package quanta.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

public enum Constant {
    SEARCH_ALL_NODES("allNodes"), //
    SEARCH_CUR_NODE("curNode"), //
    SEARCH_TYPE_USERS("userAll"), //
    SEARCH_TYPE_LINKED_NODES("linkedNodes"), //
    SEARCH_TYPE_RDF_SUBJECTS("rdfSubjects"), //
    ENC_TAG("<[ENC]>"), //
    FEED_NEW("myNewMessages"), //
    FEED_PUB("publicPosts"), //
    FEED_TOFROMME("toFromMe"), //
    FEED_TOME("toMe"), //
    FEED_FROMMETOUSER("fromMeToUser"), //
    FEED_FROMME("fromMe"), //
    FEED_FROMFRIENDS("fromFriends"), //
    FEED_LOCAL("local"), //
    FEED_NODEFEED("nodeFeed"), //
    ATTACHMENT_PRIMARY("p"), //
    ATTACHMENT_HEADER("h");

    @JsonValue
    private final String value;

    private Constant(String value) {
        this.value = value;
    }

    public String toString() {
        return value;
    }

    public String s() {
        return value;
    }
}
