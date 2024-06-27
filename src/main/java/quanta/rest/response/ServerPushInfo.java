package quanta.rest.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ServerPushInfo {
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
