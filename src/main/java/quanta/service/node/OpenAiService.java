package quanta.service.node;

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
import quanta.model.client.openai.ChatCompletionResponse;
import quanta.model.client.openai.ChatGPTRequest;
import quanta.model.client.openai.ChatMessage;
import quanta.model.client.openai.Choice;
import quanta.mongo.model.SubNode;
import quanta.util.Util;

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

    public String getOpenAiAnswer(SubNode node) {
        // todo-0: make this configurable
        String url = "https://api.openai.com/v1/chat/completions";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + prop.getOpenAiKey());

        // todo-0: make this configurable
        String model = "gpt-3.5-turbo";

        // ChatMessage message = new ChatMessage("system", "system", "You are a helpful assistant.");
        ChatMessage message = new ChatMessage("user", node.getContent());
        List<ChatMessage> messages = List.of(message);
        double temperature = 0.7;

        ChatGPTRequest request = new ChatGPTRequest(model, messages, temperature);
        HttpEntity<ChatGPTRequest> entity = new HttpEntity<>(request, headers);
        ResponseEntity<ChatCompletionResponse> response =
                restTemplate.exchange(url, HttpMethod.POST, entity, ChatCompletionResponse.class);

        ChatCompletionResponse ccr = response.getBody();
        return formatAnswer(ccr);
    }

    public static String formatAnswer(ChatCompletionResponse ccr) {
        StringBuilder sb = new StringBuilder();
        int counter = 0;
        for (Choice choice : ccr.getChoices()) {
            if (counter > 0) {
                sb.append("\n\n");
            }
            sb.append(choice.getMessage().getRole() + ": " + choice.getMessage().getContent());
            counter++;
        }
        return sb.toString();
    }
}
