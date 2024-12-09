package quanta.model.client;

public class SystemConfig {
    // Holds the AI Config node id
    private String agentNodeId;
    private String prompt; // ex: "you are a helpful assistant"
    private String foldersToInclude; // newline delimited list of file paths
    private String foldersToExclude; // newline delimited list of file paths
    private String template;
    private String model; // ex: "gpt-4"
    private String service;
    private Integer maxWords;
    private Double temperature;
    private String fileExtensions;

    public String getAgentNodeId() {
        return agentNodeId;
    }

    public void setAgentNodeId(String agentNodeId) {
        this.agentNodeId = agentNodeId;
    }

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    public String getFoldersToInclude() {
        return foldersToInclude;
    }

    public void setFoldersToInclude(String filesToInclude) {
        this.foldersToInclude = filesToInclude;
    }

    public String getFoldersToExclude() {
        return foldersToExclude;
    }

    public void setFoldersToExclude(String foldersToExclude) {
        this.foldersToExclude = foldersToExclude;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getService() {
        return service;
    }

    public void setService(String service) {
        this.service = service;
    }

    public Double getTemperature() {
        return temperature;
    }

    public void setTemperature(Double temperature) {
        this.temperature = temperature;
    }

    public String getTemplate() {
        return template;
    }

    public void setTemplate(String template) {
        this.template = template;
    }

    public Integer getMaxWords() {
        return maxWords;
    }

    public void setMaxWords(Integer maxWords) {
        this.maxWords = maxWords;
    }

    public String getFileExtensions() {
        return fileExtensions;
    }

    public void setFileExtensions(String fileExtensions) {
        this.fileExtensions = fileExtensions;
    }
}
