package quanta.model.client.geminiai;

import java.util.List;

public class GeminiChatRequest {
    private List<GeminiChatContent> contents;

    public GeminiChatRequest() {}

    public GeminiChatRequest(List<GeminiChatContent> contents) {
        this.contents = contents;
    }

    public List<GeminiChatContent> getContents() {
        return contents;
    }

    public void setContents(List<GeminiChatContent> contents) {
        this.contents = contents;
    }
}
