package org.subnode.actpub.model;

import org.subnode.actpub.APConst;

/**
 * Follow object.
 */
public class APOFollow extends APObj {
    public APOFollow() {
        put(AP.context, APConst.CONTEXT_STREAMS);
        put(AP.type, APType.Follow);
    }

    @Override
    public APOFollow put(String key, Object val) {
        super.put(key,val);
        return this;
    }
}
