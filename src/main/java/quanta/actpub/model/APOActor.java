package quanta.actpub.model;
import static quanta.actpub.model.AP.apStr;
import java.util.Map;

public class APOActor extends APObj {
    public APOActor() {
        super();
    }

    public APOActor(Map<?, ?> obj) {
        super(obj);
    }

    public String getFollowers() {
        return apStr(this, APObj.followers);
    }

    public String getFollowing() {
        return apStr(this, APObj.following);
    }

    public String getInbox() {
        return apStr(this, APObj.inbox);
    }

    public String getOutbox() {
        return apStr(this, APObj.outbox);
    }

    public String getPreferredUsername() {
        return apStr(this, APObj.preferredUsername);
    }

    @Override
    public APOActor put(String key, Object val) {
        super.put(key, val);
        return this;
    }
}
