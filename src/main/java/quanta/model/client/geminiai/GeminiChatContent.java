package quanta.model.client.geminiai;

import java.util.List;

public class GeminiChatContent {
    private String role;
    private List<GeminiChatPart> parts;

    public GeminiChatContent() {}

    public GeminiChatContent(String role, List<GeminiChatPart> parts) {
        this.role = role;
        this.parts = parts;
    }

    public GeminiChatContent(String role, String text) {
        this.role = role;
        this.parts = new java.util.ArrayList<>();
        this.parts.add(new GeminiChatPart(text));
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public List<GeminiChatPart> getParts() {
        return parts;
    }

    public void setParts(List<GeminiChatPart> parts) {
        this.parts = parts;
    }
}
