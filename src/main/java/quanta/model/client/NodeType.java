package quanta.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

public enum NodeType {
    // INTERNAL types
    ACCOUNT("sn:account"), //
    REPO_ROOT("sn:repoRoot"), //
    INBOX("sn:inbox"), //
    INBOX_ENTRY("sn:inboxEntry"), //
    ROOM("sn:room"), //
    NOTES("sn:notes"), //
    BOOKMARK("sn:bookmark"), //
    BOOKMARK_LIST("sn:bookmarkList"), //
    EXPORTS("sn:exports"), //
    CALCULATOR("sn:calculator"), //
    CALENDAR("sn:calendar"), //
    COMMENT("sn:comment"), //
    AI_QUERY("sn:aiQuery"), //
    AI_ANSWER("sn:aiAns"), //
    RSS_FEED("sn:rssfeed"), //
    FRIEND_LIST("sn:friendList"), //
    BLOCKED_USERS("sn:blockedUsers"), //
    FRIEND("sn:friend"), //
    POSTS("sn:posts"), //

    NONE("u"), // same as 'markdown' really (untyped, default to markdown)
    PLAIN_TEXT("sn:txt"), //
    FS_FILE("fs:file"), //
    FS_FOLDER("fs:folder");

    @JsonValue
    private final String value;

    private NodeType(String value) {
        this.value = value;
    }

    public static NodeType fromType(String value) {
        // instantiate enum from string
        for (NodeType type : NodeType.values()) {
            if (type.value.equals(value)) {
                return type;
            }
        }
        return null;
    }

    public String toString() {
        return value;
    }

    public String s() {
        return value;
    }
}
