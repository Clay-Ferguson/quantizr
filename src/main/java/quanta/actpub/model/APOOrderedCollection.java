package quanta.actpub.model;

import quanta.actpub.APConst;

public class APOOrderedCollection extends APObj {
    public APOOrderedCollection() {
        put(context, APConst.CONTEXT_STREAMS);
        put(type, APType.OrderedCollection);
    }

    public APOOrderedCollection(String id, Long totalItems, String first, String last) {
        this();
        put(APObj.id, id);
        put(APObj.totalItems, totalItems);
        put(APObj.first, first);
        put(APObj.last, last);
    }

    @Override
    public APOOrderedCollection put(String key, Object val) {
        super.put(key, val);
        return this;
    }
}
