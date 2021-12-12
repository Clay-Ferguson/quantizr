package org.subnode.actpub.model;

import org.subnode.actpub.APConst;

/**
 * Accept object
 */
public class APOAccept extends APObj {
    public APOAccept() {
        put(context, APConst.CONTEXT_STREAMS);
        put(type, APType.Accept);
    }

    public APOAccept(String summary, String actor, APObj object) {
        this();
        put(APObj.summary, summary);
        put(APObj.actor, actor);
        put(APObj.object, object); 
    }

    @Override
    public APOAccept put(String key, Object val) {
        super.put(key,val);
        return this;
    }
}
