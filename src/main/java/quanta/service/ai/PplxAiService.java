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
import quanta.model.client.openai.ChatCompletionResponse;
import quanta.model.client.openai.ChatGPTRequest;
import quanta.model.client.openai.ChatMessage;
import quanta.model.client.openai.SystemConfig;
import quanta.model.client.openai.Usage;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.util.Util;
import quanta.util.XString;

/* Perplexity */
@Component
public class PplxAiService extends ServiceBase {
    String PPLX_COMP_URL = "https://api.perplexity.ai/chat/completions";

    // todo-0: These changed. Need to update online docs and project docs.
    public final String PPLX_MODEL_COMPLETION_ONLINE = "llama-3-sonar-large-32k-online"; // 70B model
    public final String PPLX_MODEL_COMPLETION_LLAMA3 = "llama-3-70b-instruct";
    public final String PPLX_MODEL_COMPLETION_CHAT = "llama-3-sonar-large-32k-chat"; // 70B model

    String COST_CODE = "PPX"; // 3 chars allowed

    DecimalFormat decimalFormatter = new DecimalFormat("0.##########");
    private static Logger log = LoggerFactory.getLogger(PplxAiService.class);

    /**
     * Queries PerplexityAI using the 'node.content' as the question to ask.
     * 
     * You can pass a node, or else 'text' to query about.
     */
    public ChatCompletionResponse getAnswer(MongoSession ms, SubNode node, String question, SystemConfig system,
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

        if (StringUtils.isEmpty(system.getPrompt())) {
            system.setPrompt("You are a helpful assistant, who will answer questions about the following information:");
        }

        String input;
        if (node != null) {
            input = aiUtil.prepareAIQuestionText(node, system);
        } else {
            input = question;
        }
        Integer maxTokens = system.getMaxWords() != null ? system.getMaxWords() * 5 : 2000;

        // Perplexity docs say not to use system prompts for the online model
        if (!PPLX_MODEL_COMPLETION_ONLINE.equals(model)) {
            messages.add(0, new ChatMessage("system", system.getPrompt()));
        }

        messages.add(new ChatMessage("user", input));
        system.setModel(model);

        WebClient webClient = Util.webClientBuilder().baseUrl(PPLX_COMP_URL)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("Authorization", "Bearer " + prop.getPplxAiKey()).build();

        aiUtil.ensureDefaults(system);
        ChatGPTRequest request = new ChatGPTRequest(system.getModel(), messages, system.getTemperature(),
                ms.getUserNodeId().toHexString(), maxTokens, null, null);

        log.debug("PPLX Req: USER: " + ms.getUserName() + " AI MODEL: " + system.getModel() + ": "
                + XString.prettyPrint(request));

        String response = Util.httpCall(webClient, request);
        ChatCompletionResponse res = null;
        try {
            res = (ChatCompletionResponse) Util.mapper.readValue(response, ChatCompletionResponse.class);
        } catch (Exception e) {
            log.error("Error parsing response: " + e.getMessage() + " response\n\n" + response);
            throw new RuntimeException("Error parsing response: " + e.getMessage());
        }

        BigDecimal cost = new BigDecimal(calculateCost(res));
        res.userCredit = aiUtil.updateUserCredit(userNode, balance, cost, COST_CODE);
        log.debug("PPLX Res: " + XString.prettyPrint(res));
        return res;
    }

    // https://docs.perplexity.ai/docs/pricing
    // #ai-model
    private double calculateCost(ChatCompletionResponse res) {
        Usage usage = res.getUsage();
        String model = res.getModel().toLowerCase();
        double outputPpm;
        double inputPpm;
        double inputPricePerReq;

        // We detect using startsWith, because the actual model used will be slightly different than the one
        // specified
        switch (model) {
            // 70B model
            case PPLX_MODEL_COMPLETION_CHAT:
                // prices per magatoken
                inputPpm = 1.0;
                outputPpm = 1.0;
                return (usage.getPromptTokens() * inputPpm / 1000000) + //
                        (usage.getCompletionTokens() * outputPpm / 1000000);

            // 70B model
            case PPLX_MODEL_COMPLETION_LLAMA3:
                // prices per magatoken
                inputPpm = 1.0;
                outputPpm = 1.0;
                return (usage.getPromptTokens() * inputPpm / 1000000) + //
                        (usage.getCompletionTokens() * outputPpm / 1000000);

            // 70B model
            case PPLX_MODEL_COMPLETION_ONLINE:
                inputPpm = 1.0;
                outputPpm = 1.0;
                inputPricePerReq = 0.005;
                return inputPricePerReq + (usage.getPromptTokens() * inputPpm / 1000000) + //
                        (usage.getCompletionTokens() * outputPpm / 1000000);

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
        aiUtil.parseAIConfig(ms, node, system);
        SubNode parent = read.getParent(ms, node);
        int nonAnswerCounter = NodeType.AI_ANSWER.s().equals(parent.getType()) ? 0 : 1;

        // this while loop should encounter alternating questions and answer nodes as we go back up
        // the tree building history.
        while (parent != null) {
            if (NodeType.AI_ANSWER.s().equals(parent.getType())) {
                nonAnswerCounter = 0;
                messages.add(0, new ChatMessage("assistant", parent.getContent()));
            } else {
                nonAnswerCounter++;
                aiUtil.parseAIConfig(ms, parent, system);

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
