package org.subnode.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

public enum NodeProp {

    // Activity Pub Properties
    ACT_PUB_ID("ap:id", "s"), //
    ACT_PUB_OBJ_TYPE("ap:objType", "s"), //

    ACT_PUB_OBJ_CONTENT("ap:objContent", "s"), //
    ACT_PUB_OBJ_INREPLYTO("ap:objInReplyTo", "s"), //
    ACT_PUB_OBJ_URL("ap:objUrl", "s"), //
    ACT_PUB_OBJ_ATTRIBUTED_TO("ap:objAttributedTo", "s"), //
    ACT_PUB_USER_ICON_URL("ap:userIcon", "s"), //
    ACT_PUB_USER_IMAGE_URL("ap:userImage", "s"), //

    // points to URL of actor object
    ACT_PUB_ACTOR_ID("ap:actorId", "s"), //

    //this is the url of the HTML for the user (for browsing directly to)
    ACT_PUB_ACTOR_URL("ap:actorUrl", "s"), //
    
    ACT_PUB_ACTOR_INBOX("ap:actorInbox", "s"), //
    ACT_PUB_SENSITIVE("ap:nsfw", "s"), //

    UNPUBLISHED("unpublished", "s"), //

    /*
     * This is the encrypted symetric key to the node data, that was encrypted using
     * the private key of the owner of the node. When nodes are shared to other
     * users the cleartext copy of this key is encrypted with the public key of the
     * user it's being shared to so that user can use their private key to decrypt
     * this key and gain access to the actual data.
     */
    ENC_KEY("sn:encKey", "s"),

    // finding this on a node means it can be safely deleted without affecting any
    // local users
    TEMP("tmp", "s"),

    /*
     * this is the one entered by the admin which DEFINES the feed, and is not to be
     * overwritten ever by the code
     */
    RSS_FEED_SRC("sn:rssFeedSrc", "s"),

    USER_PREF_PUBLIC_KEY("sn:publicKey", "s"), //
    USER_PREF_EDIT_MODE("sn:editMode", "s"), //
    USER_PREF_SHOW_METADATA("sn:showMetaData", "s"), //
    USER_PREF_PASSWORD_RESET_AUTHCODE("sn:pwdResetAuth", "s"), //
    USER_PREF_RSS_HEADINGS_ONLY("sn:rssHeadingsOnly", "s"), //
    SIGNUP_PENDING("sn:signupPending", "s"), //

    EMAIL_CONTENT("sn:content", "s"), //
    EMAIL_RECIP("sn:recip", "s"), //
    EMAIL_SUBJECT("sn:subject", "s"), //

    /*
     * when a node id pointing to some other node, we set it's target id to the node
     * it points to. For now used only for inbox to point to nodes
     */
    TARGET_ID("sn:target_id", "s"), //

    /*
     * WARNING: Only the User Account Root nodes have this property of the actual
     * user name. All other nodes reference their OWNER as an OwnerId that points to
     * these nodes.
     */
    USER("sn:user", "s"), //
    DISPLAY_NAME("sn:displayName", "s"), //
    USER_BIO("sn:userBio", "s"), //
    PWD_HASH("sn:pwdHash", "s"), //

    FILE_SYNC_LINK("fs:link", "s"), //

    // Goes on 'Friend' nodes, and is added automatically by server (not user)
    USER_NODE_ID("sn:userNodeId", "s"), //

    // this pre-existed when i created FS_FILENAME (may be unused?)
    FILENAME("sn:fileName", "s"), //
    NAME("sn:name", "s"), //

    // FS_FILE("fs:file"), //
    // FS_FOLDER("fs:folder"), //
    // FS_LUCENE("fs:lucene"), //

    IPFS_LINK("ipfs:link", "s"), //
    IPFS_REF("ipfs:ref", "s"), //
    JSON_HASH("ipfs:json", "s"), //
    SAVE_TO_IPFS("sn:saveToIpfs", "s"), //
    IPFS_LINK_NAME("ipfs:linkName", "s"), //

    // This property indicates that it's data is sourced from IPFS files, and can
    // come from another server
    IPFS_SOURCE("ipfs:source", "s"), //

    FS_LINK("fs:link", "s"), //

    /*
     * property used to indicate we should not query the IPFS network again for this
     * conten becasue we have already loaded it
     */
    IPFS_OK("ipfs:ok", "s"), //

    /*
     * mime type expressed as a file extension. Invented so we can set 'txt' v.s.
     * 'md' to turn off metadata rendering
     */
    MIME_EXT("sn:ext", "s"), //

    EMAIL("sn:email", "s"), //
    CODE("sn:code", "s"), //

    BIN_MIME("sn:mimeType", "s"), //
    BIN_FILENAME("sn:fileName", "s"), //
    BIN_SIZE("sn:size", "s"), //

    /*
     * if this is present it indicates we have a "data:" url stored here which means
     * we hava an image (for example) with data encoded inline, and this data url
     * will be stored as text in the 'attachment' of the node
     */
    BIN_DATA_URL("sn:dataUrl", "s"), //

    // This is for bash script names to whow up when browing on the tree
    // todo-1: oops we have THREE properties in there that all mapp to sn:fileName
    FILE_NAME("sn:fileName", "s"), //

    JSON_FILE_SEARCH_RESULT("sn:json", "s"), //
    NOWRAP("sn:nowrap", "s"), //

    BIN_DATA("sn:jcrData", "s"), //
    BIN("bin", "s"), //

    // Attachments that are not stored locally but by external url use this.
    BIN_URL("sn:extUrl", "s"),

    IMG_WIDTH("sn:imgWidth", "s"), //
    IMG_HEIGHT("sn:imgHeight", "s"), //
    IMG_SIZE("sn:imgSize", "s"), //
    CHILDREN_IMG_SIZES("sn:childrenImgSizes", "s"), //

    // get how many bytes of storage the user currently holds
    BIN_TOTAL("sn:binTot", "s"), //

    // amount of bytes the user is ALLOWED to save.
    BIN_QUOTA("sn:binQuota", "s"), //

    LAST_LOGIN_TIME("sn:lastLogin", "s"), //
    LAST_ACTIVE_TIME("sn:lastActive", "s"), //

    /*
     * NOTE: These two crypto keys are ONLY used for ActivityPub.
     * 
     * For the E2E Encryption capabilities of the platform, the "sn:publicKey" is the key that's used and
     * only the public key exists on the server for that E2E encryption. In other words, "sn:publicKey" is used to encrypt actual
     * data and these two defined here are only used as part of the ActivityPub user authentication process.
     */
    CRYPTO_KEY_PUBLIC("sn:cryptoKeyPublic", "s"), //
    CRYPTO_KEY_PRIVATE("sn:cryptoKeyPrivate", "s"), //

    INLINE_CHILDREN("inlineChildren", "s"), //
    PRIORITY("priority", "s"), //
    LAYOUT("layout", "s"), //
    ORDER_BY("orderBy", "s"),

    TYPE_LOCK("sn:typLoc", "s"), //
    DATE("date", "s"), //
    DURATION("duration", "s");

    @JsonValue
    private final String value;

    private final String type;

    private NodeProp(String value, String type) {
        this.value = value;
        this.type = type;
    }

    public String toString() {
        return value;
    }

    public String s() {
        return value;
    }

    public String getType() {
        return type;
    }
}