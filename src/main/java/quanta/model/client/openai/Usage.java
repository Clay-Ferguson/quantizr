package quanta.model.client.openai;

import com.fasterxml.jackson.annotation.JsonProperty;

public class Usage {
    @JsonProperty("prompt_tokens")
    private Integer promptTokens;

    @JsonProperty("completion_tokens")
    private Integer completionTokens;

    @JsonProperty("text_generation")
    private Integer totalTokens;

    public Usage() {}

    public Integer getPromptTokens() {
        return promptTokens;
    }

    public void setPromptTokens(Integer promptTokens) {
        this.promptTokens = promptTokens;
    }

    public Integer getCompletionTokens() {
        return completionTokens;
    }

    public void setCompletionTokens(Integer completionTokens) {
        this.completionTokens = completionTokens;
    }

    public Integer getTotalTokens() {
        return totalTokens;
    }

    public void setTotalTokens(Integer totalTokens) {
        this.totalTokens = totalTokens;
    }
}
