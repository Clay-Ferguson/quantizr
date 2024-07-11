package quanta.model.qai;

public class AIResponse {
    private String content;
    private Integer inputTokens;
    private Integer outputTokens;
    
    public String getContent() {
        return content;
    }
    public void setContent(String content) {
        this.content = content;
    }
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
