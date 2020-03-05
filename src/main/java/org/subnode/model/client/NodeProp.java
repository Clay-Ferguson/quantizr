package org.subnode.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

public enum NodeProp {

    // This is the encrypted symetric key to the node data, that was encrypted using
    // the private key of the owner of the node.
    ENC_KEY("sn:encKey"),
    
    /*
     * this is the one entered by the admin which DEFINES the feed, and is not to be
     * overwritten ever by the code
     */
    RSS_FEED_SRC("sn:rssFeedSrc"),

    USER_PREF_PUBLIC_KEY("sn:publicKey"), //
    USER_PREF_EDIT_MODE("sn:editMode"), //
    USER_PREF_SHOW_METADATA("sn:showMetaData"), //
    USER_PREF_IMPORT_ALLOWED("sn:importAllowed"), //
    USER_PREF_EXPORT_ALLOWED("sn:exportAllowed"), //
    USER_PREF_PASSWORD_RESET_AUTHCODE("sn:pwdResetAuth"), //
    SIGNUP_PENDING("sn:signupPending"),//

    EMAIL_CONTENT("sn:content"), //
    EMAIL_RECIP("sn:recip"), //
    EMAIL_SUBJECT("sn:subject"), //

    /*
     * WARNING: Only the User Account Root nodes have this property of the actual
     * user name. All other nodes reference their OWNER as an OwnerId that points to
     * these nodes.
     */
    USER("sn:user"), //
    PWD_HASH("sn:pwdHash"), //

    // this pre-existed when i created FS_FILENAME (may be unused?)
    FILENAME("sn:fileName"), //
    NAME("sn:name"), //

    /*
     * property used to indicate we should not query the IPFS network again for this
     * conten becasue we have already loaded it
     */
    IPFS_OK("ipfs:ok"), //

    /*
     * mime type expressed as a file extension. Invented so we can set 'txt' v.s.
     * 'md' to turn off metadata rendering
     */
    MIME_EXT("sn:ext"), //

    //PASSWORD("sn:pwd"), //
    EMAIL("sn:email"), //
    CODE("sn:code"), //

    BIN_VER("sn:binVer"), //

    BIN_MIME("sn:mimeType"), //
    BIN_FILENAME("sn:fileName"), //
    BIN_SIZE("sn:size"), //

    IPFS_NODE("sn:ipfsNode"),

    //This is for bash script names to whow up when browing on the tree
    FILE_NAME("sn:fileName"),

    JSON_FILE_SEARCH_RESULT("sn:json"),
    PRE("sn:pre"),
    NOWRAP("sn:nowrap"),

    BIN_DATA("sn:jcrData"),

    //todo-1: should this be "sn:" prefixed?
    BIN("bin"),

    IMG_WIDTH("sn:imgWidth"), //
    IMG_HEIGHT("sn:imgHeight"),//
    
    
    //todo-1: add sn:prefix
    INLINE_CHILDREN("inlineChildren"),
    PRIORITY("priority"),
    LAYOUT("layout");

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