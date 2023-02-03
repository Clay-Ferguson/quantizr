package quanta.response;

import java.util.HashMap;
import quanta.response.base.ResponseBase;

public class GetConfigResponse extends ResponseBase {
    private HashMap<String, Object> config;
    private Integer sessionTimeoutMinutes;
    private String brandingAppName;
    private boolean requireCrypto;
    private String urlIdFailMsg;
    private String userMsg;
    private String displayUserProfileId;
    private String initialNodeId;

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

    public String getBrandingAppName() {
        return brandingAppName;
    }

    public void setBrandingAppName(String brandingAppName) {
        this.brandingAppName = brandingAppName;
    }

    public boolean isRequireCrypto() {
        return requireCrypto;
    }

    public void setRequireCrypto(boolean requireCrypto) {
        this.requireCrypto = requireCrypto;
    }

    public String getUrlIdFailMsg() {
        return urlIdFailMsg;
    }

    public void setUrlIdFailMsg(String urlIdFailMsg) {
        this.urlIdFailMsg = urlIdFailMsg;
    }

    public String getUserMsg() {
        return userMsg;
    }

    public void setUserMsg(String userMsg) {
        this.userMsg = userMsg;
    }

    public String getDisplayUserProfileId() {
        return displayUserProfileId;
    }

    public void setDisplayUserProfileId(String displayUserProfileId) {
        this.displayUserProfileId = displayUserProfileId;
    }

    public String getInitialNodeId() {
        return initialNodeId;
    }

    public void setInitialNodeId(String initialNodeId) {
        this.initialNodeId = initialNodeId;
    }
}
