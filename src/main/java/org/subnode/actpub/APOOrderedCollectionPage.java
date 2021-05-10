package org.subnode.actpub;

/**
 * OrderedCollectionPage object.
 */
public class APOOrderedCollectionPage extends APObj {
    public APOOrderedCollectionPage() {
        put(AP.context, APConst.CONTEXT_STREAMS);
        put(AP.type, APType.OrderedCollectionPage);
    }
}
