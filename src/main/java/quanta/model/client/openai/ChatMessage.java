package quanta.model.client.openai;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.annotation.Transient;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import quanta.util.ChatContentDeserializer;

public class ChatMessage {
    private static Logger log = LoggerFactory.getLogger(ChatMessage.class);

    private String role;

    // This custom deserializer ensures we can read both a single string and an array of ChatContent
    @JsonDeserialize(using = ChatContentDeserializer.class)
    private List<ChatContent> content;

    public ChatMessage() {}

    public ChatMessage(String role, List<ChatContent> content) {
        this.role = role;
        this.content = content;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public List<ChatContent> getContent() {
        return content;
    }

    public void setContent(List<ChatContent> content) {
        this.content = content;
    }

    @Transient
    @JsonIgnore
    public String getTextContent() {
        if (content == null || content.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (ChatContent c : content) {
            if ("text".equals(c.getType())) {
                if (sb.length() > 0) {
                    sb.append("\n");
                }
                sb.append(c.getText());
            }
        }
        return sb.toString();
    }
}
