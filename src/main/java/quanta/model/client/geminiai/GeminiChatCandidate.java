package quanta.model.client.geminiai;

public class GeminiChatCandidate {
    private GeminiChatContent content;
    private String finishReason;
    private int index;

    public GeminiChatCandidate() {}

    public GeminiChatCandidate(GeminiChatContent content, String finishReason, int index) {
        this.content = content;
        this.finishReason = finishReason;
        this.index = index;
    }

    public GeminiChatContent getContent() {
        return content;
    }

    public void setContent(GeminiChatContent content) {
        this.content = content;
    }

    public String getFinishReason() {
        return finishReason;
    }

    public void setFinishReason(String finishReason) {
        this.finishReason = finishReason;
    }

    public int getIndex() {
        return index;
    }

    public void setIndex(int index) {
        this.index = index;
    }
}
