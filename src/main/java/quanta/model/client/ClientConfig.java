package quanta.model.client;

import java.util.HashMap;

public class ClientConfig {

    private HashMap<String, Object> config;
    private String brandingAppName;
    private boolean requireCrypto;
    private String urlIdFailMsg;
    private String userMsg;
    private String displayUserProfileId;
    private String initialNodeId;
    private String urlView;
    private String search;
    private String login;

    public String getLogin() {
        return login;
    }

    public void setLogin(String login) {
        this.login = login;
    }

    public String getSearch() {
        return search;
    }

    public void setSearch(String search) {
        this.search = search;
    }

    public String getUrlView() {
        return urlView;
    }

    public void setUrlView(String urlView) {
        this.urlView = urlView;
    }

    public HashMap<String, Object> getConfig() {
        return this.config;
    }

    public String getBrandingAppName() {
        return this.brandingAppName;
    }

    public boolean isRequireCrypto() {
        return this.requireCrypto;
    }

    public String getUrlIdFailMsg() {
        return this.urlIdFailMsg;
    }

    public String getUserMsg() {
        return this.userMsg;
    }

    public String getDisplayUserProfileId() {
        return this.displayUserProfileId;
    }

    public String getInitialNodeId() {
        return this.initialNodeId;
    }

    public void setConfig(final HashMap<String, Object> config) {
        this.config = config;
    }

    public void setBrandingAppName(final String brandingAppName) {
        this.brandingAppName = brandingAppName;
    }

    public void setRequireCrypto(final boolean requireCrypto) {
        this.requireCrypto = requireCrypto;
    }

    public void setUrlIdFailMsg(final String urlIdFailMsg) {
        this.urlIdFailMsg = urlIdFailMsg;
    }

    public void setUserMsg(final String userMsg) {
        this.userMsg = userMsg;
    }

    public void setDisplayUserProfileId(final String displayUserProfileId) {
        this.displayUserProfileId = displayUserProfileId;
    }

    public void setInitialNodeId(final String initialNodeId) {
        this.initialNodeId = initialNodeId;
    }

    public ClientConfig() {}
}
