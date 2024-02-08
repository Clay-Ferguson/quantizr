package quanta.model.client.geminiai;

public class GeminiChatPart {
    private String text;

    public GeminiChatPart() {}

    public GeminiChatPart(String text) {
        this.text = text;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }
}
