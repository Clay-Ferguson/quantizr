package quanta.response;

import java.io.Serializable;

public class ServerPushInfo implements Serializable {
    private static final long serialVersionUID = 1L;

    private String type;

    public ServerPushInfo() {}

    public ServerPushInfo(String type) {
        this.type = type;
    }

    public String getType() {
        return this.type;
    }

    public void setType(final String type) {
        this.type = type;
    }
}
