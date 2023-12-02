package quanta.model.client.oobabooga;

import java.util.List;

public class OobAiRequest {
    private List<OobAiMessage> messages;
    private String mode;

    public OobAiRequest() {}

    public OobAiRequest(List<OobAiMessage> messages, String mode) {
        this.messages = messages;
        this.mode = mode;
    }

    public List<OobAiMessage> getMessages() {
        return messages;
    }

    public void setMessages(List<OobAiMessage> messages) {
        this.messages = messages;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }
}
