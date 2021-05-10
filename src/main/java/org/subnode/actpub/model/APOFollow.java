package org.subnode.actpub.model;

import org.subnode.actpub.APConst;

/**
 * Follow object.
 */
public class APOFollow extends APObj {
    public APOFollow() {
        put(AP.context, APConst.CONTEXT_STREAMS);
        put(AP.type, APType.Follow);
    }
}
