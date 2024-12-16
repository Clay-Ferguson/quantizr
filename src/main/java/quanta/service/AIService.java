package quanta.service;

import java.math.BigDecimal;
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
import quanta.exception.base.RuntimeEx;
import quanta.model.AIMessage;
import quanta.model.AIRequest;
import quanta.model.AIResponse;
import quanta.model.client.AIModel;
import quanta.model.client.NodeType;
import quanta.model.client.SystemConfig;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;
import quanta.rest.response.UpdateAccountInfo;
import quanta.util.TL;
import quanta.util.Util;
import quanta.util.XString;
import quanta.util.val.Val;

/*
 * Originally the Anthropic Service, but we will now begin to subsume all other services into this
 * class as well since the abstraction layer to handle different AI Cloud providers differently is
 * now encapsulated in the microservice.
 */
@Component
public class AIService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(AIService.class);

    public AIResponse getAnswer(boolean agentic, SubNode node, String question, SystemConfig system, AIModel svc) {
        if (svc == null) {
            throw new RuntimeEx("No AI service selected.");
        }
        AccountNode userNode = svc_user.getAccountByUserNameAP(TL.getSC().getUserName());
        if (userNode == null) {
            throw new RuntimeEx("Unknown user.");
        }
        BigDecimal balance = svc_aiUtil.getBalance(userNode);

        // this will hold all the prior chat history
        List<AIMessage> messages = new ArrayList<>();
        if (system == null) {
            system = new SystemConfig();
        }

        if (node != null) {
            buildChatHistory(node, messages, system);
        }
        // log.debug("AI Req: messages: " + XString.prettyPrint(messages));

        String input;
        if (node != null) {
            input = svc_aiUtil.prepareAIQuestionText(node, system);
        } else {
            input = question;
        }

        Integer maxTokens = system.getMaxWords() != null ? system.getMaxWords() * 5 : 1000;
        if (maxTokens > svc.getContextLength() && svc.getContextLength() > 0) {
            maxTokens = svc.getContextLength();
        }
        system.setModel(svc.getModel());
        svc_aiUtil.ensureDefaults(system);
        String apiKey = getApiKey(svc.getService());
        String QAI_URL = "http://" + svc_prop.getQuantaAIHost() + ":" + svc_prop.getQuantaAIPort() + "/api/query";
        WebClient webClient = Util.webClientBuilder().baseUrl(QAI_URL) //
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE) //
                .defaultHeader("X-api-key", apiKey) //
                .build();

        if (system.getFileExtensions() == null) {
            system.setFileExtensions("txt");
        }

        if (!svc.isAllowSystemPrompt()) {
            system.setSystemPrompt(null);
        } else {
            if (StringUtils.isEmpty(system.getSystemPrompt())) {
                system.setSystemPrompt("You are a helpful assistant.");
            }
        }

        AIRequest request = new AIRequest();
        request.setSystemPrompt(system.getSystemPrompt());
        request.setPrompt(input);
        request.setFoldersToInclude(system.getFoldersToInclude());
        request.setFoldersToExclude(system.getFoldersToExclude());

        // if we have a template we're in Writing Mode (not conversation mode), so we don't pass context
        if (system.getTemplate() == null) {
            request.setMessages(messages);
        }

        request.setModel(svc.getModel());
        request.setService(svc.getService());
        request.setTemperature(system.getTemperature().floatValue());
        request.setMaxTokens(maxTokens);
        request.setCredit(balance.floatValue());
        request.setCodingAgent(agentic);
        request.setAgentFileExtensions(system.getFileExtensions());

        log.debug("AI Req: USER: " + TL.getSC().getUserName() + " AI Service: " + svc.getService() + ", Model="
                + svc.getModel() + ": " + XString.prettyPrint(request));
        AIResponse aiRes = null;
        String res = Util.httpCall(webClient, request);
        try {
            aiRes = (AIResponse) Util.mapper.readValue(res, AIResponse.class);
        } catch (Exception e) {
            throw new RuntimeEx("Error parsing response: " + e.getMessage() + " response\n\n" + res);
        }

        if (!StringUtils.isEmpty(aiRes.getError())) {
            throw new RuntimeEx(aiRes.getError());
        }

        String userId = TL.getSC().getUserNodeId();
        BigDecimal newBalance = svc_user.adjustCredit(userId, new BigDecimal(-aiRes.getCost()));
        svc_push.pushInfo(TL.getSC(), new UpdateAccountInfo(userId, newBalance));
        log.debug("AI Res: " + XString.prettyPrint(aiRes));
        return aiRes;
    }

    // #ai-model
    private String getApiKey(String service) {
        switch (service) {
            case "anthropic":
                return svc_prop.getAnthAiKey();
            case "openai":
                return svc_prop.getOpenAiKey();
            case "perplexity":
                return svc_prop.getPplxAiKey();
            case "gemini":
                return svc_prop.getGeminiAiKey();
            case "xai":
                return svc_prop.getXAiKey();
            default:
                throw new RuntimeEx("Unknown service: " + service);
        }
    }

    private void buildChatHistory(SubNode node, List<AIMessage> messages, SystemConfig system) {
        if (system.getAgentNodeId() == null) {
            svc_aiUtil.parseAIConfig(node, system);
        }
        SubNode parent = svc_mongoRead.getParent(node);
        int nonAnswerCounter = NodeType.AI_ANSWER.s().equals(parent.getType()) ? 0 : 1;

        // this while loop should encounter alternating questions and answer nodes as we go back up
        // the tree building history.
        while (parent != null) {
            if (NodeType.AI_ANSWER.s().equals(parent.getType())) {
                nonAnswerCounter = 0;
                messages.add(0, new AIMessage("ai", parent.getContent()));
            } else {
                nonAnswerCounter++;
                if (system.getAgentNodeId() == null) {
                    svc_aiUtil.parseAIConfig(parent, system);
                }

                // if we hit two non-answer nodes in a row that means we're at the top level of
                // where teh first question was asked, and therefore the beginning of the chat.
                if (nonAnswerCounter > 1) {
                    break;
                }
                messages.add(0, new AIMessage("human", parent.getContent()));
            }
            // walk up the tree. get parent of parent.
            parent = svc_mongoRead.getParent(parent);
        }
        // if we still don't have a system prompt check all ancestor nodes
        svc_aiUtil.getAIConfigFromAncestorNodes(parent, system);
    }
}
