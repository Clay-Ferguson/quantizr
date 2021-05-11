package org.subnode.actpub.model;

/**
 * Mention object.
 */
public class APOMention extends APObj {
    public APOMention() {
        put(APProp.type, APType.Mention);
    }

    @Override
    public APOMention put(String key, Object val) {
        super.put(key,val);
        return this;
    }
}
