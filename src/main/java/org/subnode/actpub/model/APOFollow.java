package org.subnode.actpub.model;

import org.subnode.actpub.APConst;

public class APOFollow extends APObj {
    public APOFollow() {
        put(APProp.context, APConst.CONTEXT_STREAMS);
        put(APProp.type, APType.Follow);
    }

    @Override
    public APOFollow put(String key, Object val) {
        super.put(key,val);
        return this;
    }
}
