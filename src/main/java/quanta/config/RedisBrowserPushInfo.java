package quanta.config;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import quanta.response.ServerPushInfo;

@JsonIgnoreProperties(ignoreUnknown = true)
public class RedisBrowserPushInfo extends RedisObj {

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
