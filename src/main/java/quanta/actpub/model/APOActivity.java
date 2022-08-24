package quanta.actpub.model;

import static quanta.actpub.model.AP.apAPObj;
import static quanta.actpub.model.AP.apObj;
import static quanta.actpub.model.AP.apStr;
import java.util.Map;

public class APOActivity extends APObj {
    public APOActivity() {}

    public APOActivity(Map<?, ?> obj) {
        super(obj);
    }

    public String getActor() {
        return apStr(this, APObj.actor);
    }

    public Object getObject() {
        return apObj(this, APObj.object);
    }

    // todo-0: make this smart enough to return the correct concrete class, based on type, even though we can
    // leave teh actual return value as APObj....or else have a getPerson(), getNote(), type pattern for that.
    public APObj getAPObj() {
        return apAPObj(this, APObj.object);
    }

    public APOActivity put(String key, Object val) {
        super.put(key, val);
        return this;
    }
}
