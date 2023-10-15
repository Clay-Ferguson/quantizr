package quanta.service.node;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.text.DecimalFormat;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.StringTokenizer;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
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
import quanta.model.client.openai.Usage;
import quanta.mongo.CreateNodeLocation;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.postgres.table.Tran;
import quanta.postgres.table.UserAccount;
import quanta.request.AskSubGraphRequest;
import quanta.request.CreateSubNodeRequest;
import quanta.response.AskSubGraphResponse;
import quanta.response.CreateSubNodeResponse;
import quanta.service.UserManagerService;
import quanta.util.XString;
import reactor.core.publisher.Mono;

@Component
public class OpenAiService extends ServiceBase {
    String OPENAI_MOD_URL = "https://api.openai.com/v1/moderations";
    String OPENAI_COMP_URL = "https://api.openai.com/v1/chat/completions";

    DecimalFormat decimalFormatter = new DecimalFormat("0.##########");
    private static Logger log = LoggerFactory.getLogger(OpenAiService.class);

    /**
     * Queries OpenAI using the 'node.content' as the question to ask.
     * 
     * You can pass a node, or else 'text' to query about.
     */
    public ChatCompletionResponse getOpenAiAnswer(MongoSession ms, SubNode node, String question) {

        SubNode userNode = read.getAccountByUserName(ms, ms.getUserName(), false);
        if (userNode == null) {
            throw new RuntimeException("Unknown user.");
        }

        BigDecimal balance = null;
        String userName = userNode.getStr(NodeProp.USER);
        if (user.initialGrant(userNode.getIdStr(), userName)) {
            balance = new BigDecimal(UserManagerService.INITIAL_GRANT_AMOUNT);
        } else {
            balance = tranRepository.getBalByMongoId(ms.getUserNodeId().toHexString());
            if (balance == null) {
                throw new RuntimeException("Sorry, you have no more OpenAI credit.");
            }
            int comparisonResult = balance.compareTo(BigDecimal.ZERO);
            if (comparisonResult <= 0) {
                throw new RuntimeException("Sorry, you have no more OpenAI credit.");
            }
        }

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

        WebClient webClient =
                WebClient.builder().defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                        .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + prop.getOpenAiKey())
                        .baseUrl(OPENAI_MOD_URL).build();

        Mono<ChatGPTModerationResponse> modResponse =
                webClient.post().body(Mono.just(modRequest), ChatGPTModerationRequest.class).retrieve()
                        .bodyToMono(ChatGPTModerationResponse.class);

        ChatGPTModerationResponse modRes = modResponse.block();

        if (moderationFailed(modRes)) {
            throw new RuntimeException("Sorry, the AI would reject that question.");
        }

        switch (system.getModel().toLowerCase()) {
            case "gpt-4":
            case "gpt-3.5-turbo":
                break;
            default:
                throw new RuntimeException("Only gpt-4 and gpt-3.5-turbo are currently supported: " + system.getModel()
                        + " is not supported.");
        }

        webClient = WebClient.builder().baseUrl(OPENAI_COMP_URL)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("Authorization", "Bearer " + prop.getOpenAiKey()).build();

        ChatGPTRequest request = new ChatGPTRequest(system.getModel(), messages, system.getTemperature(),
                ms.getUserNodeId().toHexString());

        log.debug("GPT Req: USER: " + ms.getUserName() + " AI MODEL: " + system.getModel() + ": "
                + XString.prettyPrint(request));

        Mono<ChatCompletionResponse> mono = webClient.post().body(BodyInserters.fromValue(request)).retrieve()
                .bodyToMono(ChatCompletionResponse.class);

        ChatCompletionResponse res = mono.block();
        updateUserCredit(userNode, balance, res);
        log.debug("GPT Res: " + XString.prettyPrint(res));
        return res;
    }

    // updates the user's credit and returns the cost of the transaction
    private void updateUserCredit(SubNode userNode, BigDecimal curBal, ChatCompletionResponse res) {
        BigDecimal cost = new BigDecimal(calculateCost(res));
        UserAccount user = userRepository.findByMongoId(userNode.getIdStr());

        if (user == null) {
            // creating here should never be necessary but we do it anyway
            log.debug("User not found, creating...");
            String userName = userNode.getStr(NodeProp.USER);
            user = userRepository.save(new UserAccount(userNode.getIdStr(), userName));
        }

        Tran debit = new Tran();
        debit.setAmt(cost);
        debit.setTransType("D");
        debit.setTs(Timestamp.from(Instant.now()));
        debit.setDescCode("OAI"); // OpenAI
        debit.setUserAccount(user);

        // Eventually we will add to this information about the gpt request too. Entire Q & A
        // debit.setDetail(mapper.valueToTree(res));

        tranRepository.save(debit);
        res.userCredit = curBal.subtract(cost);
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

    private double calculateCost(ChatCompletionResponse res) {
        Usage usage = res.getUsage();

        // price per kilotoken
        double inputPpk = 0;
        double outputPpk = 0;
        String model = res.getModel().toLowerCase();

        // We detect using startsWith, because the actual model used will be slightly different than the one
        // specified
        if (model.startsWith("gpt-4")) {
            if (usage.getPromptTokens() < 8000) {
                inputPpk = 0.03;
                outputPpk = 0.06;
            } else {
                inputPpk = 0.06;
                outputPpk = 0.12;
            }
        }
        //
        else if (model.startsWith("gpt-3.5")) {
            if (usage.getPromptTokens() < 4000) {
                inputPpk = 0.0015;
                outputPpk = 0.002;
            } else {
                inputPpk = 0.003;
                outputPpk = 0.004;
            }
        } else {
            throw new RuntimeException(
                    "Only gpt-4 and gpt-3.5-turbo are currently supported. " + res.getModel() + " is not supported.");
        }

        return (usage.getPromptTokens() * inputPpk / 1000) + (usage.getCompletionTokens() * outputPpk / 1000);
    }

    public AskSubGraphResponse askSubGraph(MongoSession ms, AskSubGraphRequest req) {
        AskSubGraphResponse res = new AskSubGraphResponse();

        // todo-1: in future use cases we'd want to allow includeComments
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
        res.setAnswer("Q: " + req.getQuestion() + "\n\nA: " + formatAnswer(answer, false));
        return res;
    }

    // Assumes node is a question, and inserts the answer to is under it as a subnode
    public void insertAnswerToQuestion(MongoSession ms, SubNode node, CreateSubNodeRequest req,
            CreateSubNodeResponse res) {
        ChatCompletionResponse aiAnswer = oai.getOpenAiAnswer(ms, node, null);
        res.setGptCredit(aiAnswer.userCredit);

        SubNode newNode = create.createNode(ms, node, null, NodeType.OPENAI_ANSWER.s(), 0L, CreateNodeLocation.FIRST,
                null, null, true, true);

        newNode.setContent(oai.formatAnswer(aiAnswer, true));
        newNode.set(NodeProp.OPENAI_RESPONSE, aiAnswer);

        newNode.touch();
        newNode.set(NodeProp.TYPE_LOCK, Boolean.valueOf(true));
        acl.inheritSharingFromParent(ms, req, res, node, newNode);
        update.save(ms, newNode);
    }
}
