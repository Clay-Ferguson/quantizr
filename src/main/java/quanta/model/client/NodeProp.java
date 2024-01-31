package quanta.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

public enum NodeProp {
    INREPLYTO("ap:objInReplyTo"), //

    USER_ICON_URL("ap:userIcon"), //

    USER_BANNER_URL("ap:userImage"), //

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
    RSS_FEED_SRC("sn:rssFeedSrc"), AUDIO_URL("sn:audioUrl"),

    USER_PREF_PUBLIC_KEY("sn:publicKey"), //
    USER_PREF_PUBLIC_SIG_KEY("sn:publicSigKey"), //

    USER_PREF_EDIT_MODE("sn:editMode"), //
    USER_PREF_SHOW_METADATA("sn:showMetaData"), //
    USER_PREF_SHOW_PROPS("sn:showProps"), //
    USER_PREF_AUTO_REFRESH_FEED("sn:autoRefreshFeed"), // #add-prop
    USER_PREF_SHOW_REPLIES("sn:showReplies"), //
    USER_PREF_PASSWORD_RESET_AUTHCODE("sn:pwdResetAuth"), //
    USER_PREF_RSS_HEADINGS_ONLY("sn:rssHeadingsOnly"), //
    USER_PREF_MAIN_PANEL_COLS("sn:mainPanelCols"), //
    USER_PREF_AI_SERVICE("sn:aiService"), //
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
    MFS_ENABLE("sn:mfsEnable"), // Mutable File System enabled (user can set this, independend of their admin
                                // authorization)
    USER_BIO("sn:userBio"), //
    USER_DID_IPNS("sn:didIPNS"), //
    USER_IPFS_KEY("sn:ipfsKey"), //

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
    // FS_LUCENE("fs:lucene"), //

    // To create an "Explorable" (by user) tree of content assign this property to a node, and set the
    // type of the node to "sn:ipfsNode" (IPFS_NODE)
    IPFS_CID("ipfs:cid"), //
    IPNS_CID("ipns:cid"), //

    // Represents an IPFS CID that is aht "Source" for the data in such a way that we assume
    // the IPFS content will supercede (and take precedence), so that we can always read from IPFS
    // and make that content be the content in our DB with fear of overwriting anything.
    IPFS_SCID("ipfs:scid"),

    JSON_HASH("ipfs:json"), //
    SAVE_TO_IPFS("sn:saveToIpfs"), //

    // todo-2: is this still used?
    IPFS_LINK_NAME("ipfs:linkName"), //

    // This property indicates that it's data is sourced from IPFS files, and can
    // come from another server
    IPFS_SOURCE("ipfs:source"), //

    FS_LINK("fs:link"), //

    /*
     * property used to indicate we should not query the IPFS network again for this conten because we
     * have already loaded it
     */
    IPFS_OK("ipfs:ok"), //

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

    // if this contains web3, then web3 active, etc.
    ALLOWED_FEATURES("sn:features"), //

    LAST_LOGIN_TIME("sn:lastLogin"), //
    LAST_ACTIVE_TIME("sn:lastActive"), //

    /*
     * NOTE: These two crypto keys are ONLY used for ActivityPub.
     *
     * For the E2E Encryption capabilities of the platform, the "sn:publicKey" and "sn:publicSigKey"
     * props are the keys used and only the public key exists on the server for that E2E encryption.
     */
    CRYPTO_KEY_PUBLIC("sn:cryptoKeyPublic"), //
    CRYPTO_KEY_PRIVATE("sn:cryptoKeyPrivate"), //

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
    AI("ai"), //
    AI_MODEL("ai-model"), //
    DURATION("duration"), //
    IN_PENDING_PATH("pendingPath"), //

    OPEN_GRAPH("sn:og"), //
    TRUNCATED("trunc"), //
    OPENAI_RESPONSE("sn:oaiRes"), //
    PPLXAI_RESPONSE("sn:pplxaiRes"), //
    HUGGINGFACE_RESPONSE("sn:hfaceRes"), //
    OOBAI_RESPONSE("sn:oobRes"), //

    // used to let nodes specify the files and paths for markdown export
    FILE_NAME("file"), //
    FOLDER_NAME("folder");

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
