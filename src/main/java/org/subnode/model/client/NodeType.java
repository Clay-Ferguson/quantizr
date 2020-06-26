package org.subnode.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

public enum NodeType {

    // INTERNAL types
    ACCOUNT("sn:account"),//
    REPO_ROOT("sn:repoRoot"), //
    TRASH_BIN("sn:trashBin"), //
    INBOX("sn:inbox"), //
    NOTES("sn:notes"), //
    
    RSS_FEED("sn:rssfeed"), //
    FRIEND_LIST("sn:friendList"), //
    FRIEND("sn:friend"), //
    USER_FEED("sn:userFeed"), //

    NONE("u"), //same as 'markdown' really
    PLAIN_TEXT("sn:txt"), //
    FS_FILE("fs:file"), //
    FS_FOLDER("fs:folder"), //
    FS_LUCENE("fs:lucene"), //
    IPFS_NODE("sn:ipfsNode");

    @JsonValue
    private final String value;

    private NodeType(String value) {
        this.value = value;
    }

    public String toString() {
        return value;
    }

    public String s() {
        return value;
    }
}