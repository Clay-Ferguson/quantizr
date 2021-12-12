package quanta.response;

import java.util.HashMap;
import quanta.response.base.ResponseBase;

public class GetConfigResponse extends ResponseBase {
    private HashMap<String, Object> config;

    public HashMap<String, Object> getConfig() {
        return config;
    }

    public void setConfig(HashMap<String, Object> config) {
        this.config = config;
    }
}
