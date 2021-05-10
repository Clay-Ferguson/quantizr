package org.subnode.actpub;

/**
 * Accept object.
 */
public class APOAccept extends APObj {
    public APOAccept() {
        put(AP.context, APConst.CONTEXT_STREAMS);
        put(AP.type, APType.Accept);
    }
}
