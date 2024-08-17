package quanta.redis;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class RedisBrowserPushInfo extends RedisObj {
    // 'token' is login token for login session that is the recipient of 'info'
    private String token;
    private String type; // payload type
    private String payload;

    public RedisBrowserPushInfo() {}

    public RedisBrowserPushInfo(String token, String payload, String type) {
        this.token = token;
        this.payload = payload;
        this.type = type;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getPayload() {
        return payload;
    }

    public void setPayload(String payload) {
        this.payload = payload;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}
