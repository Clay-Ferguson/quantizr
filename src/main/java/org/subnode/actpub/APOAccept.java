package org.subnode.actpub;

/**
 * Accept object.
 */
public class APOAccept extends APObj {
    public APOAccept() {
        put("@context", APConst.CONTEXT_STREAMS);
        put("type", "Accept");
    }
}
