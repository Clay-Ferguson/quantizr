package quanta.actpub.model;

import quanta.actpub.APConst;

/**
 * Announce object
 */
public class APOAnnounce extends APObj {
    public APOAnnounce() {
        put(context, APConst.CONTEXT_STREAMS);
        put(type, APType.Announce);
    }

    public APOAnnounce(String actor, String id, String published, String object) {
        this();
        put(APObj.id, id);
        put(APObj.published, published);
        put(APObj.object, object);
        put(APObj.actor, actor);
    }

    @Override
    public APOAnnounce put(String key, Object val) {
        super.put(key, val);
        return this;
    }
}
