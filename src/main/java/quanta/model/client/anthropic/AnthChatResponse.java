package quanta.model.client.anthropic;

import java.math.BigDecimal;

import java.util.List;

public class AnthChatResponse {
    private String id;
    private String type;
    private String role;
    private String model;
    private List<AnthChatContent> content;
    private AnthUsage usage;

    // transient, not part of pojo
    public BigDecimal userCredit;

    public AnthChatResponse() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public List<AnthChatContent> getContent() {
        return content;
    }

    public void setContent(List<AnthChatContent> content) {
        this.content = content;
    }

    public AnthUsage getUsage() {
        return usage;
    }

    public void setUsage(AnthUsage usage) {
        this.usage = usage;
    }
}
