package quanta.model.client.openai;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonProperty;

public class ChatGPTRequest {
    private String user;
    private String model;
    private List<ChatMessage> messages;
    private Double temperature;

    @JsonProperty("max_tokens")
    private Integer maxTokens;

    public ChatGPTRequest() {}

    public ChatGPTRequest(String model, List<ChatMessage> messages, double temperature, String user,
            Integer maxTokens) {
        this.model = model;
        this.messages = messages;
        this.temperature = temperature;
        this.user = user;
        this.maxTokens = maxTokens;
    }

    public String getUser() {
        return user;
    }

    public void setUser(String user) {
        this.user = user;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public List<ChatMessage> getMessages() {
        return messages;
    }

    public void setMessages(List<ChatMessage> messages) {
        this.messages = messages;
    }

    public Double getTemperature() {
        return temperature;
    }

    public void setTemperature(Double temperature) {
        this.temperature = temperature;
    }

    public Integer getMaxTokens() {
        return maxTokens;
    }

    public void setMaxTokens(Integer maxTokens) {
        this.maxTokens = maxTokens;
    }
}
