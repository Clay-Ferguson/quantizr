package quanta.actpub.model;

import quanta.actpub.APConst;

/**
 * Decentralized Identity Info
 */
public class APODID extends APObj {
    public APODID() {
        put(context, new APList() //
                .val(APConst.CONTEXT_STREAMS) //
                .val(new APOLanguage()));
        put(type, APType.DID);
    }

    public APODID(String userName) {
        this();
        put(APObj.name, userName);
    }

    @Override
    public APODID put(String key, Object val) {
        super.put(key, val);
        return this;
    }
}
