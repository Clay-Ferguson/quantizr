package org.subnode.actpub.model;

import org.subnode.actpub.APConst;

/**
 * OrderedCollection object.
 */
public class APOOrderedCollection extends APObj {
    public APOOrderedCollection() {
        put(APProp.context, APConst.CONTEXT_STREAMS);
        put(APProp.type, APType.OrderedCollection);
    }

    @Override
    public APOOrderedCollection put(String key, Object val) {
        super.put(key,val);
        return this;
    }
}
