package org.subnode.actpub.model;

import org.subnode.actpub.APConst;

/**
 * Create object.
 */
public class APOCreate extends APObj {
    public APOCreate() {
        put(AP.context, new APList() //
                .val(APConst.CONTEXT_STREAMS) //
                .val(newContextObj()));
        put(AP.type, APType.Create);
    }
}
