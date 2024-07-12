package quanta.model.qai;

import java.util.List;

public class AIRequest {
    private String service;
    private String model;
    private String systemPrompt;
    private String prompt;
    private List<AIMessage> messages;
    private Float temperature;
    private Integer maxTokens;

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
}
