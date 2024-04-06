package quanta.model.client.openai;

public class ChatGPTResponseFormat {
    private String type;

    public ChatGPTResponseFormat() {}

    public ChatGPTResponseFormat(String type) {
        this.type = type;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}

