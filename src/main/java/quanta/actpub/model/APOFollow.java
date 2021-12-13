package quanta.actpub.model;

import quanta.actpub.APConst;
import static quanta.util.Util.*;

/**
 * Follow object
 */
public class APOFollow extends APObj {
    public APOFollow() {
        put(context, APConst.CONTEXT_STREAMS);
        put(type, APType.Follow);
    }

    public APOFollow(String id, String actor, Object object) {
        this();
        if (ok(id)) {
            put(APObj.id, id);
        }
        put(APObj.actor, actor);
        put(APObj.object, object);
    }

    @Override
    public APOFollow put(String key, Object val) {
        super.put(key, val);
        return this;
    }
}