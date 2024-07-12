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
import org.springframework.web.reactive.function.client.WebClient;
import quanta.config.ServiceBase;
import quanta.model.client.NodeType;
import quanta.model.client.openai.SystemConfig;
import quanta.model.qai.AIMessage;
import quanta.model.qai.AIRequest;
import quanta.model.qai.AIResponse;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.util.Util;
import quanta.util.XString;
import quanta.util.val.Val;

/*
 * Originally the Anthropic Service, but we will now begin to subsume all other services into this
 * class as well since the abstraction layer to handle different AI Cloud providers differently is
 * now encapsulated in the microservice.
 * 
 */
@Component
public class AIService extends ServiceBase {
    String ANTH_COMP_URL = "https://api.anthropic.com/v1/messages";
    String API_VERSION = "2023-06-01";

    public final String ANTH_OPUS_MODEL_COMPLETION_CHAT = "claude-3-opus-20240229";
    public final String ANTH_SONNET_MODEL_COMPLETION_CHAT = "claude-3-5-sonnet-20240620";
    public final String OPENAI_MODEL_COMPLETION = "gpt-4o";

    String COST_CODE = "ANT"; // 3 chars allowed

    DecimalFormat decimalFormatter = new DecimalFormat("0.##########");
    private static Logger log = LoggerFactory.getLogger(AIService.class);

    public AIResponse getAnswer(MongoSession ms, SubNode node, String question, SystemConfig system, String model,
            String service, Val<BigDecimal> userCredit) {
        SubNode userNode = read.getAccountByUserName(ms, ms.getUserName(), false);
        if (userNode == null) {
            throw new RuntimeException("Unknown user.");
        }

        // todo-0: need to pass this into the microservice so it can precalculate how much they can
        // potentially cost in this
        // transaction and ensure they have enough balance.
        BigDecimal balance = aiUtil.getBalance(ms, userNode);

        // this will hold all the prior chat history
        List<AIMessage> messages = new ArrayList<>();
        if (system == null) {
            system = new SystemConfig();
        }

        if (StringUtils.isEmpty(system.getPrompt())) {
            system.setPrompt("You are a helpful assistant.");
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

        Integer maxTokens = system.getMaxWords() != null ? system.getMaxWords() * 5 : 2000;
        system.setModel(model);
        aiUtil.ensureDefaults(system);
        String apiKey = getApiKey(service);
        String QAI_URL = "http://" + prop.getQuantaAIHost() + ":" + prop.getQuantaAIPort() + "/api/query";
        WebClient webClient = Util.webClientBuilder().baseUrl(QAI_URL) //
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE) //
                .defaultHeader("X-api-key", apiKey) //
                .build();

        AIRequest request = new AIRequest();
        request.setSystemPrompt(system.getPrompt());
        request.setPrompt(input);
        request.setMessages(messages);
        request.setModel(model);
        request.setService(service);
        request.setTemperature(0.7f);
        request.setMaxTokens(maxTokens);

        log.debug("AI Req: USER: " + ms.getUserName() + " AI MODEL: " + model + ": " + XString.prettyPrint(request));

        AIResponse aiRes = null;
        String res = Util.httpCall(webClient, request);
        try {
            aiRes = (AIResponse) Util.mapper.readValue(res, AIResponse.class);
        } catch (Exception e) {
            String msg = "Error parsing response: " + e.getMessage() + " response\n\n" + res;
            log.error(msg);
            throw new RuntimeException(msg);
        }

        BigDecimal cost = new BigDecimal(calculateCost(aiRes, model));
        userCredit.setVal(aiUtil.updateUserCredit(userNode, balance, cost, COST_CODE));
        log.debug("AI Res: " + XString.prettyPrint(aiRes));
        return aiRes;
    }

    private String getApiKey(String service) {
        switch (service) {
            case "anthropic":
                return prop.getAnthAiKey();
            case "openai":
                return prop.getOpenAiKey();
            default:
                throw new RuntimeException("Unknown service: " + service);
        }
    }

    // https://www.anthropic.com/pricing#anthropic-api
    private double calculateCost(AIResponse res, String model) {
        double inputPpm = 0;
        double outputPpm = 0;

        // We detect using startsWith, because the actual model used will be slightly different than the
        // one specified
        switch (model) {
            case OPENAI_MODEL_COMPLETION:
                // prices per magatoken
                double inputPpk = 0.005;
                double outputPpk = 0.015;
                return (res.getInputTokens() * inputPpk / 1000) + (res.getOutputTokens() * outputPpk / 1000);

            case ANTH_OPUS_MODEL_COMPLETION_CHAT:
                // prices per magatoken
                inputPpm = 15;
                outputPpm = 75;
                return (res.getInputTokens() * inputPpm / 1000000) + //
                        (res.getOutputTokens() * outputPpm / 1000000);

            case ANTH_SONNET_MODEL_COMPLETION_CHAT:
                // prices per magatoken
                inputPpm = 3.0;
                outputPpm = 15.0;
                return (res.getInputTokens() * inputPpm / 1000000) + //
                        (res.getOutputTokens() * outputPpm / 1000000);

            default:
                throw new RuntimeException("Model not supported: " + model + " is not supported.");
        }
    }

    private void buildChatHistory(MongoSession ms, SubNode node, List<AIMessage> messages, SystemConfig system) {
        aiUtil.parseAIConfig(ms, node, system);
        SubNode parent = read.getParent(ms, node);
        int nonAnswerCounter = NodeType.AI_ANSWER.s().equals(parent.getType()) ? 0 : 1;

        // this while loop should encounter alternating questions and answer nodes as we go back up
        // the tree building history.
        while (parent != null) {
            if (NodeType.AI_ANSWER.s().equals(parent.getType())) {
                nonAnswerCounter = 0;
                messages.add(0, new AIMessage("ai", parent.getContent()));
            } else {
                nonAnswerCounter++;
                aiUtil.parseAIConfig(ms, parent, system);

                // if we hit two non-answer nodes in a row that means we're at the top level of
                // where teh first question was asked, and therefore the beginning of the chat.
                if (nonAnswerCounter > 1) {
                    break;
                }
                messages.add(0, new AIMessage("human", parent.getContent()));
            }
            // walk up the tree. get parent of parent.
            parent = read.getParent(ms, parent);
        }
        // if we still don't have a system prompt check all ancestor nodes
        aiUtil.getAIConfigFromAncestorNodes(ms, parent, system);
    }
}
