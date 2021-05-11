package org.subnode.actpub.model;

import org.subnode.actpub.APConst;

/**
 * Note object.
 */
public class APONote extends APObj {
    public APONote() {
        put(AP.context, new APList() //
                .val(APConst.CONTEXT_STREAMS) //
                .val(new APOLanguage()));
        put(AP.type, APType.Note);
    }

    @Override
    public APONote put(String key, Object val) {
        super.put(key,val);
        return this;
    }
}
