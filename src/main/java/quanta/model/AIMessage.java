package quanta.model;

public class AIMessage {
    private String type; // system, human, ai
    private String content;

    public AIMessage() {}

    public AIMessage(String type, String content) {
        this.type = type;
        this.content = content;
    }

    public String getType() {
        return type;
    }
    public void setType(String type) {
        this.type = type;
    }
    public String getContent() {
        return content;
    }
    public void setContent(String content) {
        this.content = content;
    }
}
