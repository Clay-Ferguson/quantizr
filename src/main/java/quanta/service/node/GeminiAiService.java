package quanta.service.node;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import quanta.config.ServiceBase;
import quanta.model.client.geminiai.GeminiChatContent;
import quanta.model.client.geminiai.GeminiChatRequest;
import quanta.model.client.geminiai.GeminiChatResponse;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.util.Util;
import quanta.util.XString;
import reactor.core.publisher.Mono;

// todo-0: move all these AI services class into a new package called 'ai'
@Component
public class GeminiAiService extends ServiceBase {
    String GEMINI_COMP_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=";
    String COST_CODE = "GEM"; // 3 chars allowed
    DecimalFormat decimalFormatter = new DecimalFormat("0.##########");
    private static Logger log = LoggerFactory.getLogger(GeminiAiService.class);

    /**
     * Queries Gemini AI using the 'node.content' as the question to ask.
     * 
     * You can pass a node, or else 'text' to query about.
     */
    public GeminiChatResponse getAnswer(MongoSession ms, SubNode node, String question) {

        SubNode userNode = read.getAccountByUserName(ms, ms.getUserName(), false);
        if (userNode == null) {
            throw new RuntimeException("Unknown user.");
        }
        BigDecimal balance = aiUtil.getBalance(ms, userNode);

        // this will hold all the prior chat history
        List<GeminiChatContent> contents = new ArrayList<>();

        if (node != null) {
            buildChatHistory(ms, node, contents);
        }

        String input = node != null ? node.getContent() : question;
        contents.add(new GeminiChatContent("user", input));

        if (StringUtils.isEmpty(prop.getGeminiAiKey())) {
            throw new RuntimeException("Gemini API key not set.");
        }

        WebClient webClient = Util.webClientBuilder().baseUrl(GEMINI_COMP_URL + prop.getGeminiAiKey())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE) //
                .build();

        GeminiChatRequest request = new GeminiChatRequest(contents);
        log.debug("Gemini Req: USER: " + ms.getUserName() + ": " + XString.prettyPrint(request));

        /*
         * Prior to tweaking the Models to support the new GPT-4 we had been able to just use 'request' here
         * instead of the stringified version of it. I haven't tried to figure out why the non-stringified
         * fails, but it does fail.
         */
        Mono<GeminiChatResponse> mono = webClient.post().body(BodyInserters.fromValue(XString.prettyPrint(request)))
                .retrieve().bodyToMono(GeminiChatResponse.class);
        GeminiChatResponse res = mono.block();
        BigDecimal cost = new BigDecimal(calculateCost(res));
        res.credit = aiUtil.updateUserCredit(userNode, balance, cost, COST_CODE);
        log.debug("Gemini Res: " + XString.prettyPrint(res));
        return res;

        // ================================
        // DO NOT DELETE:
        // We can use this for debugging to see the raw request and response
        // String response = webClient.post().body(BodyInserters.fromValue(XString.prettyPrint(request)))
        // .accept(MediaType.APPLICATION_JSON).retrieve().bodyToMono(String.class).block();
        // log.debug("RESPONSE: " + response);
        // return "";
    }

    private double calculateCost(GeminiChatResponse res) {
        return 0.01; // todo-0: implement
    }

    /**
     * we walk up the tree, to build as much chat history as we have so we can create the full
     * conversation context
     */
    private void buildChatHistory(MongoSession ms, SubNode node, List<GeminiChatContent> contents) {
        SubNode parent = read.getParent(ms, node);
        int nonAnswerCounter = aiUtil.isAnyAnswerType(parent.getType()) ? 0 : 1;

        // this while loop should encounter alternating questions and answer nodes as we go back up
        // the tree building history.
        while (parent != null) {
            if (aiUtil.isAnyAnswerType(parent.getType())) {
                nonAnswerCounter = 0;
                contents.add(0, new GeminiChatContent("model", parent.getContent()));
            } else {
                nonAnswerCounter++;

                // if we hit two non-answer nodes in a row that means we're at the top level of
                // where teh first question was asked, and therefore the beginning of the chat.
                if (nonAnswerCounter > 1) {
                    break;
                }

                // addAttachments(content, parent);
                contents.add(0, new GeminiChatContent("user", parent.getContent()));
            }

            // walk up the tree. get parent of parent.
            parent = read.getParent(ms, parent);
        }
    }
}
