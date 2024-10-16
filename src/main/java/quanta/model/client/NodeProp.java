package quanta.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

public enum NodeProp {
    /*
     * This is the encrypted symetric key to the node data, that was encrypted using the private key of
     * the owner of the node. When nodes are shared to other users the cleartext copy of this key is
     * encrypted with the public key of the user it's being shared to so that user can use their private
     * key to decrypt this key and gain access to the actual data.
     */
    ENC_KEY("sn:encKey"), //
    CRYPTO_SIG("sn:sig"), //

    // stands for "[r]ecursive SHA256" of all children of node.
    SUBGRAPH_HASH("sn:rSHA256"), //

    /*
     * this is the one entered by the admin which DEFINES the feed, and is not to be overwritten ever by
     * the code
     */
    RSS_FEED_SRC("sn:rssFeedSrc"), //
    AUDIO_URL("sn:audioUrl"), //

    USER_PREF_PUBLIC_KEY("sn:publicKey"), //
    USER_PREF_PUBLIC_SIG_KEY("sn:publicSigKey"), //

    USER_PREF_EDIT_MODE("sn:editMode"), //
    USER_PREF_AI_MODE("sn:aiMode"), //
    USER_PREF_SHOW_METADATA("sn:showMetaData"), //
    USER_PREF_SHOW_PROPS("sn:showProps"), //
    USER_PREF_AUTO_REFRESH_FEED("sn:autoRefreshFeed"), // #add-prop
    USER_PREF_SHOW_REPLIES("sn:showReplies"), //
    USER_PREF_PASSWORD_RESET_AUTHCODE("sn:pwdResetAuth"), //
    USER_PREF_RSS_HEADINGS_ONLY("sn:rssHeadingsOnly"), //
    USER_PREF_MAIN_PANEL_COLS("sn:mainPanelCols"), //
    USER_PREF_AI_SERVICE("sn:aiService"), //
    USER_PREF_AI_FILE_EXTENSIONS("sn:aiAgentFileExtensions"), //
    USER_PREF_AI_FOLDERS_TO_INCLUDE("sn:aiAgentFoldersToInclude"), //
    USER_PREF_AI_FOLDERS_TO_EXCLUDE("sn:aiAgentFoldersToExclude"), //
    USER_PREF_AI_MAX_WORDS("sn:aiMaxWords"), //
    USER_PREF_AI_TEMPERATURE("sn:aiTemp"), //
    SIGNUP_PENDING("sn:signupPending"), //

    EMAIL_CONTENT("sn:content"), //
    EMAIL_RECIP("sn:recip"), //
    EMAIL_SUBJECT("sn:subject"), //

    /*
     * when a node id pointing to some other node, we set it's target id to the node it points to. For
     * now used only for inbox to point to nodes
     */
    TARGET_ID("sn:target_id"), //
    BOOKMARK_SEARCH_TEXT("search"), //

    /*
     * WARNING: Only the User Account Root nodes have this property of the actual user name. All other
     * nodes reference their OWNER as an OwnerId that points to these nodes.
     */
    USER("sn:user"), //
    DISPLAY_NAME("sn:displayName"), //
    USER_BIO("sn:userBio"), //

    // This holds the user's defined tags they've defined in the Tags Editor Dlg, and is stored on their
    // account node.
    USER_TAGS("sn:tags"), //
    USER_BLOCK_WORDS("sn:blockWords"), //
    USER_RECENT_TYPES("sn:recentTypes"), //

    PWD_HASH("sn:pwdHash"), //
    VOTE("vote"), //

    FILE_SYNC_LINK("fs:link"), //

    // Goes on 'Friend' nodes, and is added automatically by server (not user)
    USER_NODE_ID("sn:userNodeId"), //
    NAME("sn:name"), //

    // FS_FILE("fs:file"), //
    // FS_FOLDER("fs:folder"), //

    FS_LINK("fs:link"), //

    /*
     * mime type expressed as a file extension. Invented so we can set 'txt' v.s. 'md' to turn off
     * metadata rendering
     */
    MIME_EXT("sn:ext"), //

    EMAIL("sn:email"), //
    CODE("sn:code"), //

    JSON_FILE_SEARCH_RESULT("sn:json"), //
    NOWRAP("sn:nowrap"), //

    BIN("bin"),

    // get how many bytes of storage the user currently holds
    BIN_TOTAL("sn:binTot"),

    // amount of bytes the user is ALLOWED to save.
    BIN_QUOTA("sn:binQuota"), //

    LAST_LOGIN_TIME("sn:lastLogin"), //
    LAST_ACTIVE_TIME("sn:lastActive"), //

    INLINE_CHILDREN("inlineChildren"), //
    EXPANSION_BY_USER("expansionByUser"),

    PRIORITY("priority"), //
    PRIORITY_FULL("p.priority"), //

    LAYOUT("layout"), //
    ORDER_BY("orderBy"), //
    NO_EXPORT("noexport"), //

    TYPE_LOCK("sn:typLoc"), //

    DATE("date"), //
    DATE_FULL("p.date"), //

    UNPUBLISHED("unpub"), //
    AI_PROMPT("ai"), //
    AI_FOLDERS_TO_INCLUDE("aiFolders"), //
    AI_FOLDERS_TO_EXCLUDE("aiFoldersExclude"), //
    AI_FILE_EXTENSIONS("aiFileExt"), //
    AI_SERVICE("aiService"), //
    AI_QUERY_TEMPLATE("aiTemplate"), //
    AI_MAX_WORDS("aiMaxWords"), //
    AI_TEMPERATURE("aiTemp"), //
    DURATION("duration"), //
    IN_PENDING_PATH("pendingPath"), //
    SIG_FAIL("sigFail"), //

    OPEN_GRAPH("sn:og"), //
    TRUNCATED("trunc"); //

    @JsonValue
    private final String value;

    private NodeProp(String value) {
        this.value = value;
    }

    public String toString() {
        return value;
    }

    public String s() {
        return value;
    }
}
