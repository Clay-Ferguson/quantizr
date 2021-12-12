package quanta.actpub.model;

public class APOMention extends APObj {
    public APOMention() {
        put(type, APType.Mention);
    }

    public APOMention(String href, String name) {
        this();
        put(APObj.href, href);
        put(APObj.name, name);
    }

    @Override
    public APOMention put(String key, Object val) {
        super.put(key, val);
        return this;
    }
}
