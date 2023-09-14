package quanta.service.node;

import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.StringTokenizer;
import org.apache.commons.lang3.StringUtils;
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
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.openai.ChatCompletionResponse;
import quanta.model.client.openai.ChatGPTModerationRequest;
import quanta.model.client.openai.ChatGPTModerationResponse;
import quanta.model.client.openai.ChatGPTRequest;
import quanta.model.client.openai.ChatGPTTextModerationItem;
import quanta.model.client.openai.ChatMessage;
import quanta.model.client.openai.Choice;
import quanta.model.client.openai.SystemConfig;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.AskSubGraphRequest;
import quanta.response.AskSubGraphResponse;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import quanta.util.XString;
import quanta.util.val.Val;

@Component
public class OpenAiService extends ServiceBase {
    String OPENAI_MOD_URL = "https://api.openai.com/v1/moderations";
    String OPENAI_COMP_URL = "https://api.openai.com/v1/chat/completions";

    DecimalFormat decimalFormatter = new DecimalFormat("0.##########");

    private static final RestTemplate restTemplate = new RestTemplate(Util.getClientHttpRequestFactory(300000));
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
     * 
     * You can pass a node, or else 'text' to query about.
     */
    public ChatCompletionResponse getOpenAiAnswer(MongoSession ms, SubNode node, String question) {

        SubNode userNode = read.getUserNodeByUserName(ms, ms.getUserName(), false);
        if (userNode == null) {
            throw new RuntimeException("Unknown user.");
        }

        // grant unpaid users a whopping nickle to play with
        if (!userNode.hasProp(NodeProp.OPENAI_USER_CREDIT.s())) {
            userNode.set(NodeProp.OPENAI_USER_CREDIT, 0.05);
        }

        Double val = userNode.getFloat(NodeProp.OPENAI_USER_CREDIT);
        if (val == null) {
            throw new RuntimeException("Sorry, you have no more OpenAI credit.");
        }

        Val<Double> userCredit = new Val<>(val);
        if (userCredit.getVal() < 0) {
            throw new RuntimeException("Sorry, you have no more OpenAI credit.");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + prop.getOpenAiKey());

        // this will hold all the prior chat history
        List<ChatMessage> messages = new ArrayList<>();

        SystemConfig system = new SystemConfig();

        if (node != null) {
            buildChatHistory(ms, node, messages, system);
        }

        if (StringUtils.isEmpty(system.getPrompt())) {
            system.setPrompt("You are a helpful assistant, who will answer questions about the following information:");
        }

        if (StringUtils.isEmpty(system.getModel())) {
            system.setModel("gpt-4");
        }

        String input = node != null ? node.getContent() : question;
        messages.add(0, new ChatMessage("system", system.getPrompt()));
        messages.add(new ChatMessage("user", input));

        /* Moderate Call before submitting */
        String contentToModerate = concatenateContent(messages);
        ChatGPTModerationRequest modRequest = new ChatGPTModerationRequest(contentToModerate);
        HttpEntity<ChatGPTModerationRequest> modEntity = new HttpEntity<>(modRequest, headers);
        ResponseEntity<ChatGPTModerationResponse> modResponse =
                restTemplate.exchange(OPENAI_MOD_URL, HttpMethod.POST, modEntity, ChatGPTModerationResponse.class);

        if (moderationFailed(modResponse.getBody())) {
            throw new RuntimeException("Sorry, the AI would reject that question.");
        }

        ChatGPTRequest request = new ChatGPTRequest(system.getModel(), messages, system.getTemperature(),
                ms.getUserNodeId().toHexString());
        log.debug("GPT Req: USER: " + ms.getUserName() + " AI MODEL: " + system.getModel() + ": "
                + XString.prettyPrint(request));
        HttpEntity<ChatGPTRequest> entity = new HttpEntity<>(request, headers);
        ResponseEntity<ChatCompletionResponse> response =
                restTemplate.exchange(OPENAI_COMP_URL, HttpMethod.POST, entity, ChatCompletionResponse.class);

        ChatCompletionResponse res = response.getBody();
        log.debug("GPT Res: " + XString.prettyPrint(res));

        updateUserCredit(userNode, userCredit, res);
        res.userCredit = userCredit.getVal();
        return res;
    }

    private void updateUserCredit(SubNode userNode, Val<Double> userCredit, ChatCompletionResponse res) {
        arun.run(as -> {
            // update user consumption
            Long userQuota = userNode.getInt(NodeProp.OPENAI_QUERY_COUNT);
            userNode.set(NodeProp.OPENAI_QUERY_COUNT, userQuota + 1);

            Long inputCount = userNode.getInt(NodeProp.OPENAI_IN_TOKEN_COUNT);
            userNode.set(NodeProp.OPENAI_IN_TOKEN_COUNT, inputCount + res.getUsage().getPromptTokens());

            Long outputCount = userNode.getInt(NodeProp.OPENAI_OUT_TOKEN_COUNT);
            userNode.set(NodeProp.OPENAI_OUT_TOKEN_COUNT, outputCount + res.getUsage().getCompletionTokens());

            Double cost = calculateCost(inputCount, outputCount);
            userCredit.setVal(userCredit.getVal() - cost);
            userNode.set(NodeProp.OPENAI_USER_CREDIT, userCredit.getVal());

            update.save(as, userNode);
            return null;
        });
    }

    private boolean moderationFailed(ChatGPTModerationResponse modResponse) {
        if (modResponse == null || modResponse.getResults() == null || modResponse.getResults().length == 0) {
            return false;
        }

        for (ChatGPTTextModerationItem result : modResponse.getResults()) {
            if (result.isFlagged()) {
                return true;
            }
        }
        return false;
    }

    private String concatenateContent(List<ChatMessage> messages) {
        StringBuilder result = new StringBuilder();

        for (int i = 0; i < messages.size(); i++) {
            if (i > 0) {
                result.append(", ");
            }
            result.append(messages.get(i).getContent());
        }

        return result.toString();
    }

    /**
     * we walk up the tree, to build as much chat history as we have so we can create the full
     * 
     * conversation context, If any of the nodes contain a "system: ..." line of text that will be used
     * as the system we return, so users will always be able to embed the system instructions into a
     * question.
     */
    private void buildChatHistory(MongoSession ms, SubNode node, List<ChatMessage> messages, SystemConfig system) {
        parseAISystemFromContent(node, system);
        SubNode parent = read.getParent(ms, node);
        int nonAnswerCounter = NodeType.OPENAI_ANSWER.s().equals(parent.getType()) ? 0 : 1;

        // this while loop should encounter alternating questions and answer nodes as we go back up
        // the tree building history.
        while (parent != null) {
            if (NodeType.OPENAI_ANSWER.s().equals(parent.getType())) {
                nonAnswerCounter = 0;
                messages.add(0, new ChatMessage("assistant", parent.getContent()));
            } else {
                nonAnswerCounter++;
                parseAISystemFromContent(parent, system);

                // if we hit two non-answer nodes in a row that means we're at the top level of
                // where teh first question was asked, and therefore the beginning of the chat.
                if (nonAnswerCounter > 1) {
                    break;
                }

                messages.add(0, new ChatMessage("user", parent.getContent()));
            }

            // walk up the tree. get parent of parent.
            parent = read.getParent(ms, parent);
        }

        // if we still don't have a system prompt check all ancestor nodes
        getSystemPromptFromAncestorNodes(ms, parent, system);
    }

    public void getSystemPromptFromAncestorNodes(MongoSession ms, SubNode node, SystemConfig system) {
        while (node != null) {
            parseAISystemFromContent(node, system);
            if (system.isConfigured()) {
                return;
            }
            node = read.getParent(ms, node);
        }
    }

    public void parseAISystemFromContent(SubNode node, SystemConfig system) {
        if (system.isConfigured())
            return;

        if (StringUtils.isEmpty(system.getPrompt()) && node.hasProp(NodeProp.AI.s())) {
            system.setPrompt(node.getStr(NodeProp.AI.s()));
        }

        if (StringUtils.isEmpty(system.getModel()) && node.hasProp(NodeProp.AI_MODEL.s())) {
            system.setModel(node.getStr(NodeProp.AI_MODEL.s()));
        }

        // are we now configured from props?
        if (system.isConfigured())
            return;

        StringTokenizer t = new StringTokenizer(node.getContent(), "\n\r", false);

        while (t.hasMoreTokens()) {
            String tok = t.nextToken();
            if (StringUtils.isEmpty(system.getPrompt()) && tok.toLowerCase().startsWith(NodeProp.AI.s() + ":")) {
                system.setPrompt(tok.substring(3).trim());
            }

            if (StringUtils.isEmpty(system.getModel()) && tok.toLowerCase().startsWith(NodeProp.AI_MODEL.s() + ":")) {
                system.setModel(tok.substring(9).trim());
            }
        }
    }

    public String formatAnswer(ChatCompletionResponse ccr, boolean nullify) {
        StringBuilder sb = new StringBuilder();
        int counter = 0;
        for (Choice choice : ccr.getChoices()) {
            if (counter > 0) {
                sb.append("\n\n");
            }
            sb.append(/* choice.getMessage().getRole() + ": " + */ choice.getMessage().getContent());

            // Since we store the answer text in the content of the node and also store the answer object
            // on the node we nullify the content here so it isn't duplicated in the MongoDb storage.
            if (nullify) {
                choice.getMessage().setContent(null);
            }
            counter++;
        }
        return sb.toString();
    }

    public String getOpenAiStats(MongoSession ms) {
        ms = ThreadLocals.ensure(ms);
        Iterable<SubNode> accountNodes = read.getAccountNodes(ms, null, null, null, -1, false, true);

        StringBuilder sb = new StringBuilder();
        sb.append("\nOpenAI Queries\n");

        // add in admin account
        appendUserStats(sb, read.getDbRoot());

        /*
         * scan all userAccountNodes, and set a zero amount for those not found (which will be the correct
         * amount).
         */
        for (SubNode usrNode : accountNodes) {
            appendUserStats(sb, usrNode);
        }
        return sb.toString();
    }

    private void appendUserStats(StringBuilder sb, SubNode usrNode) {
        log.debug("usrNode: " + XString.prettyPrint(usrNode));
        Long count = usrNode.getInt(NodeProp.OPENAI_QUERY_COUNT);
        if (count > 0) {
            Long inTokenCount = usrNode.getInt(NodeProp.OPENAI_IN_TOKEN_COUNT);
            Long outTokenCount = usrNode.getInt(NodeProp.OPENAI_OUT_TOKEN_COUNT);
            Double userCredit =
                    usrNode.hasProp(NodeProp.OPENAI_USER_CREDIT.s()) ? usrNode.getFloat(NodeProp.OPENAI_USER_CREDIT)
                            : 0.0;

            sb.append("    " + usrNode.getStr(NodeProp.USER) + //
                    " -> Queries: " + String.valueOf(count) + " Tokens In/Out: (" //
                    + String.valueOf(inTokenCount) + "/" //
                    + String.valueOf(outTokenCount) + ")" + //
                    " Charges: $" + decimalFormatter.format(calculateCost(inTokenCount, outTokenCount)) + //
                    " Credit: $" + decimalFormatter.format(userCredit) + "\n");
        }
    }

    private double calculateCost(Long inTokenCount, Long outTokenCount) {
        return (inTokenCount * 0.003 / 1000) + (outTokenCount * 0.004 / 1000);
    }

    public AskSubGraphResponse askSubGraph(MongoSession ms, AskSubGraphRequest req) {
        AskSubGraphResponse res = new AskSubGraphResponse();

        // todo-0: in future use cases we'd want to allow includeComments
        List<SubNode> nodes = read.getFlatSubGraph(ms, req.getNodeId(), false);
        int counter = 0;

        StringBuilder sb = new StringBuilder();
        SubNode node = read.getNode(ms, req.getNodeId());
        sb.append(node.getContent() + "\n\n");

        for (SubNode n : nodes) {
            sb.append(n.getContent() + "\n\n");
            counter++;

            if (!ms.isAdmin()) {
                // we can remove these limitations once we have user quotas in place.
                if (counter > 100) {
                    throw new RuntimeException("Too many nodes in subgraph.");
                }
                if (sb.length() > 10000) {
                    throw new RuntimeException("Too many characters in subgraph.");
                }
            }
        }
        sb.append(req.getQuestion());

        ChatCompletionResponse answer = getOpenAiAnswer(ms, null, sb.toString());
        res.setGptCredit(answer.userCredit);
        res.setAnswer(formatAnswer(answer, false));
        return res;
    }
}
