package quanta.model.client.openai;

import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.annotation.Transient;
import com.fasterxml.jackson.annotation.JsonIgnore;

public class ChatMessage {
    @SuppressWarnings("unused")
    private static Logger log = LoggerFactory.getLogger(ChatMessage.class);

    private String role;
    private Object content; // {type, text, image_url} or String

    public ChatMessage() {}

    public ChatMessage(String role, Object content) {
        this.role = role;
        this.content = content;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public Object getContent() {
        return content;
    }

    public void setContent(Object content) {
        this.content = content;
    }

    @Transient
    @JsonIgnore
    public String getTextContent() {
        if (content instanceof String) {
            return (String) content;
        }
        if (content instanceof List contentList) {
            StringBuilder sb = new StringBuilder();
            for (Object c : contentList) {
                if (c instanceof Map cMap) {
                    if ("text".equals(cMap.get("type"))) {
                        if (sb.length() > 0) {
                            sb.append("\n");
                        }
                        sb.append(cMap.get("text"));
                    }
                } else if (c instanceof String cString) {
                    if (sb.length() > 0) {
                        sb.append("\n");
                    }
                    sb.append(cString);
                }
            }
            return sb.toString();
        }
        return null;
    }
}
