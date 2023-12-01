package quanta.service.node;

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
import quanta.model.client.huggingface.HuggingFaceRequest;
import quanta.model.client.huggingface.HuggingFaceResponse;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.util.XString;
import reactor.core.publisher.Mono;

@Component
public class HuggingFaceService extends ServiceBase {
    // String HUGGINGFACE_COMP_URL =
    // "https://api-inference.huggingface.co/models/bert-large-uncased-whole-word-masking-finetuned-squad";
    String HUGGINGFACE_COMP_URL = "https://api-inference.huggingface.co/models/deepset/roberta-base-squad2";

    private static Logger log = LoggerFactory.getLogger(HuggingFaceService.class);

    /**
     * Queries AI using the 'node.content' as the question to ask.
     * 
     * You can pass a node, or else 'text' to query about.
     */
    public HuggingFaceResponse getAnswer(MongoSession ms, SubNode node, String question) {
        if (true)
            throw new RuntimeException("HuggingFace currently not enabled. Work in progress");

        SubNode userNode = read.getAccountByUserName(ms, ms.getUserName(), false);
        if (userNode == null) {
            throw new RuntimeException("Unknown user.");
        }

        String apiKey = "";

        WebClient webClient = WebClient.builder().baseUrl(HUGGINGFACE_COMP_URL)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("Authorization", "Bearer " + apiKey).build();

        String input = node != null ? node.getContent() : question;

        HuggingFaceRequest request = new HuggingFaceRequest(input);
        buildChatHistory(ms, node, request.getInputs().getPastUserInputs(),
                request.getInputs().getGeneratedResponses());

        if (request.getInputs().getPastUserInputs().size() != request.getInputs().getGeneratedResponses().size()) {
            throw new RuntimeException("Past user inputs and generated responses are not the same size.");
        }

        log.debug("GPT Req: USER: " + ms.getUserName() + ": " + XString.prettyPrint(request));

        /*
         * Prior to tweaking the Models to support the new GPT-4 we had been able to just use 'request' here
         * instead of the stringified version of it. I haven't tried to figure out why the non-stringified
         * fails, but it does fail.
         */
        Mono<HuggingFaceResponse> mono = webClient.post().body(BodyInserters.fromValue(XString.prettyPrint(request)))
                .retrieve().bodyToMono(HuggingFaceResponse.class);
        HuggingFaceResponse res = mono.block();
        log.debug("RESPONSE: " + XString.prettyPrint(res));

        // ================================
        // DO NOT DELETE:
        // We can use this for debugging to see the raw request and response
        // String response = webClient.post().body(BodyInserters.fromValue(XString.prettyPrint(request)))
        // .accept(MediaType.APPLICATION_JSON).retrieve().bodyToMono(String.class).block();
        // log.debug("RESPONSE: " + response);

        return res;
    }

    /**
     * we walk up the tree, to build as much chat history as we have so we can create the full context
     */
    private void buildChatHistory(MongoSession ms, SubNode node, List<String> pastUserInputs,
            List<String> generatedResponses) {
        SubNode parent = read.getParent(ms, node);
        int nonAnswerCounter = NodeType.OPENAI_ANSWER.s().equals(parent.getType()) ? 0 : 1;

        // this while loop should encounter alternating questions and answer nodes as we go back up
        // the tree building history.
        while (parent != null) {

            // we allow either type here (todo-0: add that to the openai stuff too)
            if (NodeType.OPENAI_ANSWER.s().equals(parent.getType())
                    || NodeType.HUGGINGFACE_ANSWER.s().equals(parent.getType())) {
                nonAnswerCounter = 0;
                generatedResponses.add(0, parent.getContent());
            } else {
                nonAnswerCounter++;

                // if we hit two non-answer nodes in a row that means we're at the top level of
                // where teh first question was asked, and therefore the beginning of the chat.
                if (nonAnswerCounter > 1) {
                    break;
                }
                pastUserInputs.add(0, parent.getContent());
            }

            // walk up the tree. get parent of parent.
            parent = read.getParent(ms, parent);
        }
    }
}
