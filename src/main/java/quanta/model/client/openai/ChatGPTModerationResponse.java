package quanta.model.client.openai;

public class ChatGPTModerationResponse {
    private String id;
    private String model;
    private ChatGPTTextModerationItem[] results;

    public ChatGPTModerationResponse() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public ChatGPTTextModerationItem[] getResults() {
        return results;
    }

    public void setResults(ChatGPTTextModerationItem[] results) {
        this.results = results;
    }
}
