package quanta.model.client;

import java.util.HashMap;

public class ClientConfig {

    private HashMap<String, Object> config;
    private String brandingAppName;
    private boolean requireCrypto;
    // #ai-model
    private boolean useOpenAi;
    private boolean usePplxAi;
    private boolean useGeminiAi;
    private boolean useAnthAi;
    private boolean useXAi;
    private String userMsg;
    private String displayUserProfileId;
    private String initialNodeId;
    private String urlView;
    private String search;
    private String login;
    private String paymentLink;
    private boolean aiAgentEnabled;
    private String qaiProjectsFolder;
    private String qaiDataFolder;
    private String userGuideUrl;

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

    public boolean isUseOpenAi() {
        return useOpenAi;
    }

    public void setUseOpenAi(boolean useOpenAi) {
        this.useOpenAi = useOpenAi;
    }

    public boolean isUsePplxAi() {
        return usePplxAi;
    }

    public void setUsePplxAi(boolean usePplxAi) {
        this.usePplxAi = usePplxAi;
    }

    public boolean isUseGeminiAi() {
        return useGeminiAi;
    }

    public void setUseGeminiAi(boolean useGeminiAi) {
        this.useGeminiAi = useGeminiAi;
    }

    public boolean isUseAnthAi() {
        return useAnthAi;
    }

    public void setUseAnthAi(boolean useAnthAi) {
        this.useAnthAi = useAnthAi;
    }

    public boolean isUseXAi() {
        return useXAi;
    }

    public void setUseXAi(boolean useXAi) {
        this.useXAi = useXAi;
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

    public void setUserMsg(final String userMsg) {
        this.userMsg = userMsg;
    }

    public void setDisplayUserProfileId(final String displayUserProfileId) {
        this.displayUserProfileId = displayUserProfileId;
    }

    public void setInitialNodeId(final String initialNodeId) {
        this.initialNodeId = initialNodeId;
    }

    public String getPaymentLink() {
        return paymentLink;
    }

    public void setPaymentLink(String paymentLink) {
        this.paymentLink = paymentLink;
    }

    public boolean isAiAgentEnabled() {
        return aiAgentEnabled;
    }

    public void setAiAgentEnabled(boolean aiAgentEnabled) {
        this.aiAgentEnabled = aiAgentEnabled;
    }

    public String getUserGuideUrl() {
        return userGuideUrl;
    }

    public void setUserGuideUrl(String userGuideUrl) {
        this.userGuideUrl = userGuideUrl;
    }

    public String getQaiProjectsFolder() {
        return qaiProjectsFolder;
    }

    public void setQaiProjectsFolder(String qaiProjectsFolder) {
        this.qaiProjectsFolder = qaiProjectsFolder;
    }

    public String getQaiDataFolder() {
        return qaiDataFolder;
    }

    public void setQaiDataFolder(String qaiDataFolder) {
        this.qaiDataFolder = qaiDataFolder;
    }

    public ClientConfig() {}
}
