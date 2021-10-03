package org.subnode.actpub.model;

import org.subnode.actpub.APConst;

public class APONote extends APObj {
    public APONote() {
        put(APProp.context, new APList() //
                .val(APConst.CONTEXT_STREAMS) //
                .val(new APOLanguage()));
        put(APProp.type, APType.Note);
    }

    @Override
    public APONote put(String key, Object val) {
        super.put(key,val);
        return this;
    }
}
