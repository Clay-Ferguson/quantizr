package quanta.service.node;

import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import quanta.config.ServiceBase;
import quanta.model.client.NodeType;
import quanta.model.client.openai.ChatCompletionResponse;
import quanta.model.client.openai.ChatGPTRequest;
import quanta.model.client.openai.ChatMessage;
import quanta.model.client.openai.Choice;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import quanta.util.XString;

@Component
public class OpenAiService extends ServiceBase {
    private static final RestTemplate restTemplate = new RestTemplate(Util.getClientHttpRequestFactory(60000));
    public static final ObjectMapper mapper = new ObjectMapper();

    // NOTE: This didn't allow unknown properties as expected but putting the
    // following in the JSON classes did:
    // @JsonIgnoreProperties(ignoreUnknown = true)
    {
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    private static Logger log = LoggerFactory.getLogger(OpenAiService.class);

    /**
     * Queries OpenAI using the 'node.content' as the question to ask.
     */
    public ChatCompletionResponse getOpenAiAnswer(MongoSession ms, SubNode node) {
        // todo-0: need a business plan for how end users can access OpenAI
        ThreadLocals.requireAdmin();

        // todo-0: make this configurable
        String url = "https://api.openai.com/v1/chat/completions";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + prop.getOpenAiKey());

        // todo-0: make this configurable
        String model = "gpt-3.5-turbo";

        List<ChatMessage> messages = new ArrayList<>();
        buildChatHistory(ms, node, messages);

        messages.add(0, new ChatMessage("system", "You are a helpful assistant."));
        messages.add(new ChatMessage("user", node.getContent()));

        log.debug("Chat Query: " + XString.prettyPrint(messages));

        double temperature = 0.7;

        ChatGPTRequest request = new ChatGPTRequest(model, messages, temperature);
        HttpEntity<ChatGPTRequest> entity = new HttpEntity<>(request, headers);
        ResponseEntity<ChatCompletionResponse> response =
                restTemplate.exchange(url, HttpMethod.POST, entity, ChatCompletionResponse.class);

        return response.getBody();
    }

    // we walk up the tree, to build as much chat history as we have so we can create the full
    // conversation context
    private void buildChatHistory(MongoSession ms, SubNode node, List<ChatMessage> messages) {
        SubNode parent = read.getParent(ms, node);
        boolean lastWasUser = NodeType.OPENAI_ANSWER.s().equals(node.getType());

        // this while loop should encounter alternating questions and answer nodes as we go back up
        // the tree building history.
        while (parent != null) {
            if (NodeType.OPENAI_ANSWER.s().equals(parent.getType())) {
                lastWasUser = false;
                messages.add(0, new ChatMessage("assistant", parent.getContent()));
            } else {
                // if we hit two non-answer nodes in a row that means we're at the top level of
                // where teh first question was asked, and therefore the beginning of the chat.
                if (lastWasUser) {
                    break;
                }
                lastWasUser = true;
                messages.add(0, new ChatMessage("user", parent.getContent()));
            }

            // walk up the tree. get parent of parent.
            parent = read.getParent(ms, parent);
        }
    }

    public String formatAnswer(ChatCompletionResponse ccr) {
        StringBuilder sb = new StringBuilder();
        int counter = 0;
        for (Choice choice : ccr.getChoices()) {
            if (counter > 0) {
                sb.append("\n\n");
            }
            sb.append(/* choice.getMessage().getRole() + ": " + */ choice.getMessage().getContent());
            counter++;
        }
        return sb.toString();
    }
}
