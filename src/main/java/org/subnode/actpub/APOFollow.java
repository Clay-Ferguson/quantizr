package org.subnode.actpub;

/**
 * Follow object.
 */
public class APOFollow extends APObj {
    public APOFollow() {
        put("@context", APConst.CONTEXT_STREAMS);
        put("type", "Follow");
    }
}
