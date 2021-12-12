package org.subnode.actpub.model;

import org.subnode.actpub.APConst;
import static org.subnode.util.Util.*;

/**
 * Undo object
 */
public class APOUndo extends APObj {
    public APOUndo() {
        put(context, APConst.CONTEXT_STREAMS);
        put(type, APType.Undo);
    }

    public APOUndo(String id, String actor, Object object) {
        this();
        if (ok(id)) {
            put(APObj.id, id);
        }
        put(APObj.actor, actor);
        put(APObj.object, object);
    }

    @Override
    public APOUndo put(String key, Object val) {
        super.put(key, val);
        return this;
    }
}
