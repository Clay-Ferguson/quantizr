package quanta.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Models UserPreferences
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class UserPreferences {

    private boolean editMode;
    private String aiMode;

    private boolean showMetaData;
    private boolean showProps;
    private boolean autoRefreshFeed; // #add-prop
    private boolean showReplies;
    private boolean rssHeadlinesOnly;
    // valid Range = 4 thru 8, inclusive.
    private long mainPanelCols = 6;
    private String aiService;
    private String aiAgentFileExtensions;
    private String aiAgentFoldersToInclude;
    private String aiAgentFoldersToExclude;

    private Integer aiMaxWords;
    private Double aiTemperature;

    @JsonProperty(required = false)
    private long maxUploadFileSize;

    @JsonProperty(required = false)
    public long getMaxUploadFileSize() {
        return maxUploadFileSize;
    }

    @JsonProperty(required = false)
    public void setMaxUploadFileSize(long maxUploadFileSize) {
        this.maxUploadFileSize = maxUploadFileSize;
    }

    @JsonProperty(required = false)
    public long getMainPanelCols() {
        return mainPanelCols;
    }

    @JsonProperty(required = false)
    public void setMainPanelCols(long mainPanelCols) {
        this.mainPanelCols = mainPanelCols;
    }

    public String getAiService() {
        return aiService;
    }

    public void setAiService(String aiService) {
        this.aiService = aiService;
    }

    public boolean isEditMode() {
        return this.editMode;
    }

    public boolean isShowMetaData() {
        return this.showMetaData;
    }

    public boolean isShowProps() {
        return this.showProps;
    }

    public boolean isAutoRefreshFeed() {
        return this.autoRefreshFeed;
    }

    public boolean isShowReplies() {
        return this.showReplies;
    }

    public boolean isRssHeadlinesOnly() {
        return this.rssHeadlinesOnly;
    }

    public void setEditMode(final boolean editMode) {
        this.editMode = editMode;
    }

    public void setShowMetaData(final boolean showMetaData) {
        this.showMetaData = showMetaData;
    }

    public void setShowProps(final boolean showProps) {
        this.showProps = showProps;
    }

    public void setAutoRefreshFeed(final boolean autoRefreshFeed) {
        this.autoRefreshFeed = autoRefreshFeed;
    }

    public void setShowReplies(final boolean showReplies) {
        this.showReplies = showReplies;
    }

    public void setRssHeadlinesOnly(final boolean rssHeadlinesOnly) {
        this.rssHeadlinesOnly = rssHeadlinesOnly;
    }

    public String getAiAgentFileExtensions() {
        return aiAgentFileExtensions;
    }

    public void setAiAgentFileExtensions(String aiAgentFileExtensions) {
        this.aiAgentFileExtensions = aiAgentFileExtensions;
    }

    public String getAiAgentFoldersToInclude() {
        return aiAgentFoldersToInclude;
    }

    public void setAiAgentFoldersToInclude(String aiAgentFoldersToInclude) {
        this.aiAgentFoldersToInclude = aiAgentFoldersToInclude;
    }

    public String getAiAgentFoldersToExclude() {
        return aiAgentFoldersToExclude;
    }

    public void setAiAgentFoldersToExclude(String aiAgentFoldersToExclude) {
        this.aiAgentFoldersToExclude = aiAgentFoldersToExclude;
    }

    public String getAiMode() {
        return aiMode;
    }

    public void setAiMode(String aiMode) {
        this.aiMode = aiMode;
    }

    public Integer getAiMaxWords() {
        return aiMaxWords;
    }

    public void setAiMaxWords(Integer aiMaxWords) {
        this.aiMaxWords = aiMaxWords;
    }

    public Double getAiTemperature() {
        return aiTemperature;
    }

    public void setAiTemperature(Double aiTemperature) {
        this.aiTemperature = aiTemperature;
    }

    public UserPreferences() {}
}
