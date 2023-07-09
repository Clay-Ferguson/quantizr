package quanta.config;

import java.io.Serializable;
import quanta.response.ServerPushInfo;

public class RedisBrowserPushInfo implements Serializable {

    private static final long serialVersionUID = 1L;

    // 'token' is login token for login session that is the recipient of 'info'
    private String token;
    private ServerPushInfo info;

    public RedisBrowserPushInfo() {}

    public RedisBrowserPushInfo(String token, ServerPushInfo info) {
        this.token = token;
        this.info = info;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public ServerPushInfo getInfo() {
        return info;
    }

    public void setInfo(ServerPushInfo info) {
        this.info = info;
    }
}
