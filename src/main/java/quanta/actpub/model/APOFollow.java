package quanta.actpub.model;

import static quanta.util.Util.ok;
import quanta.actpub.APConst;

/**
 * Follow object
 */
public class APOFollow extends APObj {
    public APOFollow() {
        put(context, APConst.CONTEXT_STREAMS);
        put(type, APType.Follow);
    }

    /* 'actor' is person doing the following, and 'target' is the person being followed */
    public APOFollow(String id, String actor, Object target) {
        this();
        if (ok(id)) {
            put(APObj.id, id);
        }
        put(APObj.actor, actor); 
        put(APObj.cc, new APList()); //todo-0: test that adding empty 'cc' doesn't break mastodon (it worked without on masto)
        put(APObj.to, new APList().val(target)); // todo-0: test that adding 'to' doesn't break mastodon (it worked without on masto)
        put(APObj.object, target); 
    }

    @Override
    public APOFollow put(String key, Object val) {
        super.put(key, val);
        return this;
    }
}
