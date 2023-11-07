package quanta.util;

import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;
import quanta.model.client.openai.ChatContent;

public class ChatContentDeserializer extends JsonDeserializer<List<ChatContent>> {
    private static Logger log = LoggerFactory.getLogger(ChatContentDeserializer.class);

    @Override
    public List<ChatContent> deserialize(JsonParser parser, DeserializationContext context)
            throws IOException, JsonProcessingException {
        JsonNode node = parser.getCodec().readTree(parser);
        if (node.isTextual()) {
            return Collections.singletonList(new ChatContent("text", node.asText(), null));
        } else if (node.isArray()) {
            return Arrays.asList(parser.getCodec().treeToValue(node, ChatContent[].class));
        }
        throw new RuntimeException("Expected array or string for ChatContent");
    }
}
