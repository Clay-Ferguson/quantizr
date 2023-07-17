package quanta.actpub.model;

public class APOTombstone extends APObj {

    public APOTombstone() {
        put(type, APType.Tombstone);
    }

    public APOTombstone(String id) {
        this();
        put(APObj.id, id);
    }

    @Override
    public APOTombstone put(String key, Object val) {
        super.put(key, val);
        return this;
    }
}
