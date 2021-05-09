package org.subnode.actpub;

/**
 * Note object.
 */
public class APONote extends APObj {
    public APONote() {
        put("@context", new APList() //
                .val(ActPubConstants.CONTEXT_STREAMS) //
                .val(newContextObj()));
        put("type", "Note");
    }
}
