package quanta.actpub.model;

import static quanta.util.Util.ok;
import quanta.actpub.APConst;

/**
 * Update object.
 * 
 * todo-0: if anything fails with sending out Person updates, try adding "published" property into the Person object if not already there, 
 * bc mastodon does this.
 */
public class APOUpdate extends APObj {
    public APOUpdate() {
        put(context, new APList() //
                .val(APConst.CONTEXT_STREAMS) //
                .val(new APOLanguage()));
        put(type, APType.Update);
    }

    public APOUpdate(String id, String actor, APObj object, APList to) {
        this();
        put(APObj.id, id);
        put(APObj.actor, actor);
        put(APObj.object, object);
        if (ok(to)) {
            put(APObj.to, to);
        }
    }

    @Override
    public APOUpdate put(String key, Object val) {
        super.put(key, val);
        return this;
    }
}
