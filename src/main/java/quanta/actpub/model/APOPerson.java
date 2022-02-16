package quanta.actpub.model;

import quanta.actpub.APConst;

/**
 * Person object
 */
public class APOPerson extends APObj {
    public APOPerson() {
        put(context, APConst.CONTEXT_STREAMS);
        put(type, APType.Person);
    }

    public APOPerson(String id) {
        this();
        put(APObj.id, id);
    }

    @Override
    public APOPerson put(String key, Object val) {
        super.put(key, val);
        return this;
    }
}
