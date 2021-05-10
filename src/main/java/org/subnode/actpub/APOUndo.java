package org.subnode.actpub;

/**
 * Undo object.
 */
public class APOUndo extends APObj {
    public APOUndo() {
        put(AP.context, APConst.CONTEXT_STREAMS);
        put(AP.type, APType.Undo);
    }
}
