package org.subnode.actpub;

/**
 * Undo object.
 */
public class APOUndo extends APObj {
    public APOUndo() {
        put("@context", ActPubConstants.CONTEXT_STREAMS);
        put("type", "Undo");
    }
}
