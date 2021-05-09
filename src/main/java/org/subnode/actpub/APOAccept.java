package org.subnode.actpub;

/**
 * Accept object.
 */
public class APOAccept extends APObj {
    public APOAccept() {
        put("@context", ActPubConstants.CONTEXT_STREAMS);
        put("type", "Accept");
    }
}
