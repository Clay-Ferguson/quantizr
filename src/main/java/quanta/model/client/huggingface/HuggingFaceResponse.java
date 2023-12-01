package quanta.model.client.huggingface;

import com.fasterxml.jackson.annotation.JsonProperty;

public class HuggingFaceResponse {
    @JsonProperty("generated_text")
    private String generatedText;

    private HuggingFaceConversation conversation;

    public HuggingFaceResponse() {}

    public String getGeneratedText() {
        return generatedText;
    }

    public void setGeneratedText(String generatedText) {
        this.generatedText = generatedText;
    }

    public HuggingFaceConversation getConversation() {
        return conversation;
    }

    public void setConversation(HuggingFaceConversation conversation) {
        this.conversation = conversation;
    }
}
