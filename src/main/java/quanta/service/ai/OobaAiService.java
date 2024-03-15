package quanta.service.ai;

import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import quanta.config.ServiceBase;
import quanta.model.client.NodeType;
import quanta.model.client.oobabooga.OobAiMessage;
import quanta.model.client.oobabooga.OobAiRequest;
import quanta.model.client.openai.ChatCompletionResponse;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.util.Util;
import quanta.util.XString;
import reactor.core.publisher.Mono;

/*
 * This is the Oobabooga Text GEneration WebUI support
 * 
 * This is the service that talks to the Oobabooga AI service, and is a work in progress. I'm having
 * an issue getting the docker container to talk to the host machine. I'm not sure if it's a docker
 * issue, or a networking issue, or what. I'm putting this approach on the back burner until I have
 * the dockerized version of the Oobabooga AI service working. However I've proven that the
 * Oobabooga AI service works, by using CURL commands against the localhost instance, so the rest of
 * this code should work once I get the dockerized version working.
 */
@Component
public class OobaAiService extends ServiceBase {
    // String COMP_URL = "http://host.docker.internal:5000/v1/chat/completions";
    String COMP_URL = "http://172.17.0.1:5000/v1/chat/completions";

    private static Logger log = LoggerFactory.getLogger(OobaAiService.class);

    /**
     * Queries AI using the 'node.content' as the question to ask.
     * 
     * You can pass a node, or else 'text' to query about.
     */
    public ChatCompletionResponse getAnswer(MongoSession ms, SubNode node, String question) {
        SubNode userNode = read.getAccountByUserName(ms, ms.getUserName(), false);
        if (userNode == null) {
            throw new RuntimeException("Unknown user.");
        }

        // todo-1: need API KEY
        // String apiKey = "";
        // if (apiKey == null || apiKey.isEmpty())
        // throw new RuntimeException("Oobabooga currently not enabled. No API Key");

        WebClient webClient = Util.webClientBuilder().baseUrl(COMP_URL)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                // .defaultHeader("Authorization", "Bearer " + apiKey) // todo-1: need API KEY
                .build();

        String input = node != null ? node.getContent() : question;
        OobAiRequest request = new OobAiRequest();

        List<OobAiMessage> messages = new ArrayList<>();

        if (node != null) {
            buildChatHistory(ms, node, messages);
        }
        messages.add(new OobAiMessage("user", input));
        log.debug("GPT Req: USER: " + ms.getUserName() + ": " + XString.prettyPrint(request));

        // Prior to tweaking the Models to support the new GPT-4 we had been able to just use 'request'
        // here
        // instead of the stringified version of it. I haven't tried to figure out why the non-stringified
        // fails, but it does fail.
        // Mono<ChatCompletionResponse> mono =
        // webClient.post().body(BodyInserters.fromValue(XString.prettyPrint(request)))
        // .retrieve().bodyToMono(ChatCompletionResponse.class);
        // ChatCompletionResponse res = mono.block();
        // log.debug("RESPONSE: " + XString.prettyPrint(res));

        // ================================
        // DO NOT DELETE:
        // We can use this for debugging to see the raw request and response
        String response = webClient.post().body(BodyInserters.fromValue(XString.prettyPrint(request))) //
                .accept(MediaType.APPLICATION_JSON).retrieve()//
                .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(), clientResponse -> {
                    // This will trigger for any response with 4xx or 5xx status codes
                    return clientResponse.bodyToMono(String.class).flatMap(errorBody -> {
                        log.debug("Error response from server: " + errorBody);
                        return Mono.error(new RuntimeException("Error response from server: " + errorBody));
                    });
                }) //
                .bodyToMono(String.class).block();
        log.debug("RESPONSE: " + response);

        // return res;
        return null;
    }

    private void buildChatHistory(MongoSession ms, SubNode node, List<OobAiMessage> messages) {
        SubNode parent = read.getParent(ms, node);
        int nonAnswerCounter = aiUtil.isAnyAnswerType(parent.getType()) ? 0 : 1;

        // this while loop should encounter alternating questions and answer nodes as we go back up
        // the tree building history.
        while (parent != null) {
            if (NodeType.OOBAI_ANSWER.s().equals(parent.getType())) {
                nonAnswerCounter = 0;
                messages.add(0, new OobAiMessage("assistant", parent.getContent()));
            } else {
                nonAnswerCounter++;

                // if we hit two non-answer nodes in a row that means we're at the top level of
                // where teh first question was asked, and therefore the beginning of the chat.
                if (nonAnswerCounter > 1) {
                    break;
                }
                messages.add(0, new OobAiMessage("user", parent.getContent()));
            }

            // walk up the tree. get parent of parent.
            parent = read.getParent(ms, parent);
        }
    }
}
