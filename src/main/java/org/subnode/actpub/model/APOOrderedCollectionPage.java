package org.subnode.actpub.model;

import org.subnode.actpub.APConst;

/**
 * OrderedCollectionPage object.
 */
public class APOOrderedCollectionPage extends APObj {
    public APOOrderedCollectionPage() {
        put(APProp.context, APConst.CONTEXT_STREAMS);
        put(APProp.type, APType.OrderedCollectionPage);
    }

    @Override
    public APOOrderedCollectionPage put(String key, Object val) {
        super.put(key,val);
        return this;
    }
}
