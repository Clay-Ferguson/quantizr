package quanta.service.ai;

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
import quanta.model.client.anthropic.AnthChatResponse;
import quanta.model.client.anthropic.AnthUsage;
import quanta.model.client.openai.ChatGPTRequest;
import quanta.model.client.openai.ChatMessage;
import quanta.model.client.openai.SystemConfig;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.util.Util;
import quanta.util.XString;
import reactor.core.publisher.Mono;

/* Anthropic */
@Component
public class AnthAiService extends ServiceBase {
    String ANTH_COMP_URL = "https://api.anthropic.com/v1/messages";
    String API_VERSION = "2023-06-01";

    public final String ANTH_OPUS_MODEL_COMPLETION_CHAT = "claude-3-opus-20240229";
    public final String ANTH_SONNET_MODEL_COMPLETION_CHAT = "claude-3-sonnet-20240229";
    String COST_CODE = "ANT"; // 3 chars allowed

    DecimalFormat decimalFormatter = new DecimalFormat("0.##########");
    private static Logger log = LoggerFactory.getLogger(AnthAiService.class);

    /**
     * Queries Anthropic AI using the 'node.content' as the question to ask.
     * 
     * You can pass a node, or else 'text' to query about.
     */
    public AnthChatResponse getAnswer(MongoSession ms, SubNode node, String question, SystemConfig system,
            String model) {

        SubNode userNode = read.getAccountByUserName(ms, ms.getUserName(), false);
        if (userNode == null) {
            throw new RuntimeException("Unknown user.");
        }
        BigDecimal balance = aiUtil.getBalance(ms, userNode);

        // this will hold all the prior chat history
        List<ChatMessage> messages = new ArrayList<>();

        if (system == null) {
            system = new SystemConfig();
        }

        if (node != null) {
            buildChatHistory(ms, node, messages, system);
        }

        String input;
        if (node != null) {
            input = aiUtil.prepareAIQuestionText(node, system);
        } else {
            input = question;
        }

        // I haven't researched whether Anthropic even supports system prompts, but I do know when I tried
        // this it fails as a bad request (todo-0: look into this)
        // messages.add(0, new ChatMessage("system", system.getPrompt()));

        messages.add(new ChatMessage("user", input));
        system.setModel(model);

        WebClient webClient = Util.webClientBuilder().baseUrl(ANTH_COMP_URL) //
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE) //
                .defaultHeader("x-api-key", prop.getAnthAiKey()) //
                .defaultHeader("anthropic-version", API_VERSION) //
                .build();

        /*
         * todo-0: do I want maxtokens set at all here? Maybe make it based on how much credit the user has
         * left? This will be something to think about across all the AI services.
         */
        ChatGPTRequest request = new ChatGPTRequest(system.getModel(), messages, system.getTemperature(),
                ms.getUserNodeId().toHexString(), 2000);

        request.setUser(null);

        /*
         * todo-0: use this to be sure we can do good error handling and get the output error text, because
         * anthropic will fail without max tokens set. Use the recent additions to the RSS feed reader to
         * see how to do full error handling and I probably need to encapsulate a good WebClient call with
         * error handling into a reusable method.
         */
        // request.setMaxTokens(null);

        request.setTemperature(null);

        log.debug("ANTH Req: USER: " + ms.getUserName() + " AI MODEL: " + system.getModel() + ": "
                + XString.prettyPrint(request));

        // Prior to tweaking the Models to support the new GPT-4 we had been able to just use 'request'
        // here instead of the stringified version of it. I haven't tried to figure out why the
        // non-stringified fails, but it does fail.
        Mono<AnthChatResponse> mono = webClient.post().body(BodyInserters.fromValue(XString.prettyPrint(request)))
                .retrieve().bodyToMono(AnthChatResponse.class);

        AnthChatResponse res = mono.block();
        BigDecimal cost = new BigDecimal(calculateCost(res));
        res.userCredit = aiUtil.updateUserCredit(userNode, balance, cost, COST_CODE);
        log.debug("ANTH Res: " + XString.prettyPrint(res));
        return res;

        // ================================
        // DO NOT DELETE:
        // We can use this for debugging to see the raw request and response
        // String response = webClient.post().body(BodyInserters.fromValue(XString.prettyPrint(request)))
        // .accept(MediaType.APPLICATION_JSON).retrieve().bodyToMono(String.class).block();
        // log.debug("RESPONSE: " + response);
        // return null;
    }

    // https://www.anthropic.com/api
    private double calculateCost(AnthChatResponse res) {
        AnthUsage usage = res.getUsage();
        String model = res.getModel().toLowerCase();
        double outputPpm;
        double inputPpm;

        // We detect using startsWith, because the actual model used will be slightly different than the
        // one specified
        switch (model) {
            case ANTH_OPUS_MODEL_COMPLETION_CHAT:
                // prices per magatoken
                inputPpm = 15;
                outputPpm = 75;
                return (usage.getInputTokens() * inputPpm / 1000000) + //
                        (usage.getOutputTokens() * outputPpm / 1000000);

            case ANTH_SONNET_MODEL_COMPLETION_CHAT:
                // prices per magatoken
                inputPpm = 3;
                outputPpm = 15;
                return (usage.getInputTokens() * inputPpm / 1000000) + //
                        (usage.getOutputTokens() * outputPpm / 1000000);

            default:
                throw new RuntimeException("Model not supported: " + res.getModel() + " is not supported.");
        }
    }

    /**
     * we walk up the tree, to build as much chat history as we have so we can create the full
     * 
     * conversation context, If any of the nodes contain a "system: ..." line of text that will be used
     * as the system we return, so users will always be able to embed the system instructions into a
     * question.
     */
    private void buildChatHistory(MongoSession ms, SubNode node, List<ChatMessage> messages, SystemConfig system) {
        aiUtil.parseAIConfig(node, system);
        SubNode parent = read.getParent(ms, node);
        int nonAnswerCounter = aiUtil.isAnyAnswerType(parent.getType()) ? 0 : 1;

        // this while loop should encounter alternating questions and answer nodes as we go back up
        // the tree building history.
        while (parent != null) {
            if (aiUtil.isAnyAnswerType(parent.getType())) {
                nonAnswerCounter = 0;
                messages.add(0, new ChatMessage("assistant", parent.getContent()));
            } else {
                nonAnswerCounter++;
                aiUtil.parseAIConfig(parent, system);

                // if we hit two non-answer nodes in a row that means we're at the top level of
                // where teh first question was asked, and therefore the beginning of the chat.
                if (nonAnswerCounter > 1) {
                    break;
                }

                // addAttachments(content, parent);
                messages.add(0, new ChatMessage("user", parent.getContent()));
            }

            // walk up the tree. get parent of parent.
            parent = read.getParent(ms, parent);
        }

        // if we still don't have a system prompt check all ancestor nodes
        aiUtil.getAIConfigFromAncestorNodes(ms, parent, system);
    }
}
