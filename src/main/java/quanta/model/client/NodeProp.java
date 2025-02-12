package quanta.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

public enum NodeProp {
    /*
     * This is the encrypted symetric key to the node data, that was encrypted using the private key of
     * the owner of the node. When nodes are shared to other users the cleartext copy of this key is
     * encrypted with the public key of the user it's being shared to so that user can use their private
     * key to decrypt this key and gain access to the actual data.
     */
    ENC_KEY("sn:encKey", null), //

    // stands for "[r]ecursive SHA256" of all children of node.
    SUBGRAPH_HASH("sn:rSHA256", null), //

    /*
     * this is the one entered by the admin which DEFINES the feed, and is not to be overwritten ever by
     * the code
     */
    RSS_FEED_SRC("sn:rssFeedSrc", null), //
    AUDIO_URL("sn:audioUrl", null), //

    USER_PREF_PUBLIC_KEY("sn:publicKey", null), //

    USER_PREF_EDIT_MODE("sn:editMode", null), //
    USER_PREF_AI_MODE("sn:aiMode", null), //
    USER_PREF_SHOW_METADATA("sn:showMetaData", null), //
    USER_PREF_SHOW_PROPS("sn:showProps", null), //
    USER_PREF_AUTO_REFRESH_FEED("sn:autoRefreshFeed", null), // #add-prop
    USER_PREF_SHOW_REPLIES("sn:showReplies", null), //
    USER_PREF_PASSWORD_RESET_AUTHCODE("sn:pwdResetAuth", null), //
    USER_PREF_RSS_HEADINGS_ONLY("sn:rssHeadingsOnly", null), //
    USER_PREF_MAIN_PANEL_COLS("sn:mainPanelCols", null), //
    SIGNUP_PENDING("sn:signupPending", null), //

    EMAIL_CONTENT("sn:content", null), //
    EMAIL_RECIP("sn:recip", null), //
    EMAIL_SUBJECT("sn:subject", null), //

    /*
     * when a node id pointing to some other node, we set it's target id to the node it points to. For
     * now used only for inbox to point to nodes
     */
    TARGET_ID("sn:target_id", null), //
    BOOKMARK_SEARCH_TEXT("search", null), //

    /*
     * WARNING: Only the User Account Root nodes have this property of the actual user name. All other
     * nodes reference their OWNER as an OwnerId that points to these nodes.
     */
    USER("sn:user", null), //
    DISPLAY_NAME("sn:displayName", null), //
    USER_BIO("sn:userBio", null), //

    // This holds the user's defined tags they've defined in the Tags Editor Dlg, and is stored on their
    // account node.
    USER_TAGS("sn:tags", null), //
    USER_SEACH_DEFINITIONS("sn:searchDefs", SearchDefinition.class), //
    USER_BLOCK_WORDS("sn:blockWords", null), //
    USER_RECENT_TYPES("sn:recentTypes", null), //
    USER_AI_BALANCE("sn:aiBalance", null), // funds available for AI services

    PWD_HASH("sn:pwdHash", null), //
    VOTE("vote", null), //

    FILE_SYNC_LINK("fs:link", null), //

    // Goes on 'Friend' nodes, and is added automatically by server (not user)
    USER_NODE_ID("sn:userNodeId", null), //
    NAME("sn:name", null), //

    // FS_FILE("fs:file", null), //
    // FS_FOLDER("fs:folder", null), //

    FS_LINK("fs:link", null), //

    /*
     * mime type expressed as a file extension. Invented so we can set 'txt' v.s. 'md' to turn off
     * metadata rendering
     */
    MIME_EXT("sn:ext", null), //

    EMAIL("sn:email", null), //
    CODE("sn:code", null), //

    JSON_FILE_SEARCH_RESULT("sn:json", null), //
    NOWRAP("sn:nowrap", null), //

    BIN("bin", null), //
    BIN_WEBSITE("bin-website", null), //

    // get how many bytes of storage the user currently holds
    BIN_TOTAL("sn:binTot", null), //

    // amount of bytes the user is ALLOWED to save.
    BIN_QUOTA("sn:binQuota", null), //

    LAST_LOGIN_TIME("sn:lastLogin", null), //
    LAST_ACTIVE_TIME("sn:lastActive", null), //

    INLINE_CHILDREN("inlineChildren", null), //
    EXPANSION_BY_USER("expansionByUser", null), //

    PRIORITY("priority", null), //
    PRIORITY_FULL("p.priority", null), //

    LAYOUT("layout", null), //
    ORDER_BY("orderBy", null), //
    NO_EXPORT("noexport", null), //

    TYPE_LOCK("sn:typLoc", null), //

    DATE("date", null), //
    DATE_FULL("p.date", null), //

    UNPUBLISHED("unpub", null), //
    WEBSITE("website", null), //
    AI_PROMPT("ai", null), //
    AI_FOLDERS_TO_INCLUDE("aiFolders", null), //
    AI_FOLDERS_TO_EXCLUDE("aiFoldersExclude", null), //
    AI_FILE_EXTENSIONS("aiFileExt", null), //
    AI_SERVICE("aiService", null), //
    AI_CONFIG("aiConfig", null), // existence of this prop means it's an AI-configured node
    AI_QUERY_TEMPLATE("aiTemplate", null), //
    AI_MAX_WORDS("aiMaxWords", null), //
    AI_TEMPERATURE("aiTemp", null), //
    DURATION("duration", null), //
    IN_PENDING_PATH("pendingPath", null), //

    OPEN_GRAPH("sn:og", null), //
    OPEN_GRAPH_LAST_UPDATE("sn:ogLastUpdate", null), //
    TRUNCATED("trunc", null); //

    @JsonValue
    private final String value;

    private final Class<?> arrayOfType;

    public Class<?> getArrayOfType() {
        return arrayOfType;
    }

    private NodeProp(String value, Class<?> arrayOfType) {
        this.value = value;
        this.arrayOfType = arrayOfType;
    }

    public String toString() {
        return value;
    }

    public String s() {
        return value;
    }
}
