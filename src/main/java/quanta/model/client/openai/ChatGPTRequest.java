package quanta.model.client.openai;

import java.util.List;

public class ChatGPTRequest {
    private String model;
    private List<ChatMessage> messages;
    private double temperature;

    public ChatGPTRequest() {}

    public ChatGPTRequest(String model, List<ChatMessage> messages, double temperature) {
        this.model = model;
        this.messages = messages;
        this.temperature = temperature;
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

    public double getTemperature() {
        return temperature;
    }

    public void setTemperature(double temperature) {
        this.temperature = temperature;
    }
}
