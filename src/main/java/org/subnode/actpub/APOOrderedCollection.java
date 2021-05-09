package org.subnode.actpub;

/**
 * OrderedCollection object.
 */
public class APOOrderedCollection extends APObj {
    public APOOrderedCollection() {
        put("@context", ActPubConstants.CONTEXT_STREAMS);
        put("type", "OrderedCollection");
    }
}
