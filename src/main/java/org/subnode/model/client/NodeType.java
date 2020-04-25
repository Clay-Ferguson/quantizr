package org.subnode.model.client;

import com.fasterxml.jackson.annotation.JsonValue;

public enum NodeType {

    //INTERNAL types
    REPO_ROOT("sn:repoRoot"), //

    //todo-1: create a 'typehandler' for this and setup just like repo_root
    TRASH_BIN("sn:trashBin"), 

    NONE("u"), //
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