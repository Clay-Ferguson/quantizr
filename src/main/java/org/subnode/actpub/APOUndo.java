package org.subnode.actpub;

/**
 * Undo object.
 */
public class APOUndo extends APObj {
    public APOUndo() {
        put("@context", APConst.CONTEXT_STREAMS);
        put("type", "Undo");
    }
}
