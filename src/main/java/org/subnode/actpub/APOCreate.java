package org.subnode.actpub;

/**
 * Create object.
 */
public class APOCreate extends APObj {
    public APOCreate() {
        put("@context", new APList() //
                .val(APConst.CONTEXT_STREAMS) //
                .val(newContextObj()));
        put("type", "Create");
    }
}
