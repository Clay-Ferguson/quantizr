package quanta.model;

import java.util.List;

public class AIRequest {
    private String service;
    private String model;
    private String systemPrompt;
    private String prompt;
    private String foldersToInclude;
    private List<AIMessage> messages;
    private Float temperature;
    private Integer maxTokens;
    private Boolean codingAgent;
    private Boolean runHal;
    private String agentFileExtensions;

    // how much user has left in their account
    private Float credit;

    public Integer getMaxTokens() {
        return maxTokens;
    }

    public void setMaxTokens(Integer maxTokens) {
        this.maxTokens = maxTokens;
    }

    public Float getTemperature() {
        return temperature;
    }

    public void setTemperature(Float temperature) {
        this.temperature = temperature;
    }

    public String getService() {
        return service;
    }

    public void setService(String service) {
        this.service = service;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getSystemPrompt() {
        return systemPrompt;
    }

    public void setSystemPrompt(String systemPrompt) {
        this.systemPrompt = systemPrompt;
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

    public void setMessages(List<AIMessage> messages) {
        this.messages = messages;
    }

    public List<AIMessage> getMessages() {
        return messages;
    }

    public Float getCredit() {
        return credit;
    }

    public void setCredit(Float credit) {
        this.credit = credit;
    }

    public Boolean getCodingAgent() {
        return codingAgent;
    }

    public void setCodingAgent(Boolean codingAgent) {
        this.codingAgent = codingAgent;
    }

    public String getAgentFileExtensions() {
        return agentFileExtensions;
    }

    public void setAgentFileExtensions(String agentFileExtensions) {
        this.agentFileExtensions = agentFileExtensions;
    }

    public Boolean getRunHal() {
        return runHal;
    }

    public void setRunHal(Boolean runHal) {
        this.runHal = runHal;
    }
}
