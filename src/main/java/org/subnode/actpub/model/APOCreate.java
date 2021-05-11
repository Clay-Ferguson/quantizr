package org.subnode.actpub.model;

import org.subnode.actpub.APConst;

/**
 * Create object.
 */
public class APOCreate extends APObj {
    public APOCreate() {
        put(AP.context, new APList() //
                .val(APConst.CONTEXT_STREAMS) //
                .val(new APOLanguage()));
        put(AP.type, APType.Create);
    }

    @Override
    public APOCreate put(String key, Object val) {
        super.put(key,val);
        return this;
    }
}
