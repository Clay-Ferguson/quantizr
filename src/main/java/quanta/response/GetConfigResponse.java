package quanta.response;

import java.util.HashMap;
import quanta.response.base.ResponseBase;

public class GetConfigResponse extends ResponseBase {
    private HashMap<String, Object> config;
    private Integer sessionTimeoutMinutes;

    public HashMap<String, Object> getConfig() {
        return config;
    }

    public void setConfig(HashMap<String, Object> config) {
        this.config = config;
    }

    public Integer getSessionTimeoutMinutes() {
        return sessionTimeoutMinutes;
    }

    public void setSessionTimeoutMinutes(Integer sessionTimeoutMinutes) {
        this.sessionTimeoutMinutes = sessionTimeoutMinutes;
    }
}
