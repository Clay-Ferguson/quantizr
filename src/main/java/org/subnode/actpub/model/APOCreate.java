package org.subnode.actpub.model;

import org.subnode.actpub.APConst;

/**
 * Create object.
 */
public class APOCreate extends APObj {
    public APOCreate() {
        put(APProp.context, new APList() //
                .val(APConst.CONTEXT_STREAMS) //
                .val(new APOLanguage()));
        put(APProp.type, APType.Create);
    }

    @Override
    public APOCreate put(String key, Object val) {
        super.put(key,val);
        return this;
    }
}
