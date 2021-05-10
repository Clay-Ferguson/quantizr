package org.subnode.actpub;

/**
 * OrderedCollection object.
 */
public class APOOrderedCollection extends APObj {
    public APOOrderedCollection() {
        put("@context", APConst.CONTEXT_STREAMS);
        put("type", "OrderedCollection");
    }
}
