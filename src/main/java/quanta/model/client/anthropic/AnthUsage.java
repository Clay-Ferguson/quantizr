package quanta.model.client.anthropic;

import com.fasterxml.jackson.annotation.JsonProperty;

public class AnthUsage {
    @JsonProperty("input_tokens")
    private Integer inputTokens;

    @JsonProperty("output_tokens")
    private Integer outputTokens;

    public AnthUsage() {}

    public Integer getInputTokens() {
        return inputTokens;
    }

    public void setInputTokens(Integer inputTokens) {
        this.inputTokens = inputTokens;
    }

    public Integer getOutputTokens() {
        return outputTokens;
    }

    public void setOutputTokens(Integer outputTokens) {
        this.outputTokens = outputTokens;
    }
}
