package quanta.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

public enum Constant {
    SEARCH_TYPE_USER_LOCAL("userLocal"), 
    SEARCH_TYPE_USER_ALL("userAll"), 
    SEARCH_TYPE_USER_FOREIGN("userForeign"), 

    ENC_TAG("<[ENC]>"),

    FEED_NEW("myNewMessages"),
    FEED_PUB("publicFediverse"),
    FEED_TOFROMME("toFromMe"),
    FEED_TOME("toMe"),
    FEED_FROMMETOUSER("fromMeToUser"),
    FEED_FROMME("fromMe"),
    FEED_FROMFRIENDS("fromFriends"),
    FEED_LOCAL("local"),  
    FEED_NODEFEED("nodeFeed");

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