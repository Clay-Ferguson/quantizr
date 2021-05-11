package org.subnode.actpub.model;

import org.subnode.actpub.APConst;

/**
 * Undo object.
 */
public class APOUndo extends APObj {
    public APOUndo() {
        put(APProp.context, APConst.CONTEXT_STREAMS);
        put(APProp.type, APType.Undo);
    }

    @Override
    public APOUndo put(String key, Object val) {
        super.put(key,val);
        return this;
    }
}
