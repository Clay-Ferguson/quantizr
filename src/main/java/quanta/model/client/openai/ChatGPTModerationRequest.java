package quanta.model.client.openai;

public class ChatGPTModerationRequest {
    private String input;

    public ChatGPTModerationRequest() {}

    public ChatGPTModerationRequest(String input) {
        this.input = input;
    }

    public String getInput() {
        return input;
    }

    public void setInput(String input) {
        this.input = input;
    }
}
