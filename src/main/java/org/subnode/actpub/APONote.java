package org.subnode.actpub;

/**
 * Note object.
 */
public class APONote extends APObj {
    public APONote() {
        put(AP.context, new APList() //
                .val(APConst.CONTEXT_STREAMS) //
                .val(newContextObj()));
        put(AP.type, APType.Note);
    }
}
