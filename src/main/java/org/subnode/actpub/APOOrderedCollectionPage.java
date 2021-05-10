package org.subnode.actpub;

/**
 * OrderedCollectionPage object.
 */
public class APOOrderedCollectionPage extends APObj {
    public APOOrderedCollectionPage() {
        put("@context", APConst.CONTEXT_STREAMS);
        put("type", "OrderedCollectionPage");
    }
}
