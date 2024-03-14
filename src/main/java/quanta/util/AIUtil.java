package quanta.util;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.model.client.AIServiceName;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.anthropic.AnthChatContent;
import quanta.model.client.anthropic.AnthChatResponse;
import quanta.model.client.geminiai.GeminiChatCandidate;
import quanta.model.client.geminiai.GeminiChatContent;
import quanta.model.client.geminiai.GeminiChatPart;
import quanta.model.client.geminiai.GeminiChatResponse;
import quanta.model.client.openai.ChatCompletionResponse;
import quanta.model.client.openai.Choice;
import quanta.model.client.openai.SystemConfig;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.postgres.table.Tran;
import quanta.postgres.table.UserAccount;
import quanta.request.AskSubGraphRequest;
import quanta.response.AskSubGraphResponse;
import quanta.service.UserManagerService;

@Component
public class AIUtil extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(AIUtil.class);

    public void parseAIConfig(SubNode node, SystemConfig system) {
        if (StringUtils.isEmpty(system.getPrompt()) && node.hasProp(NodeProp.AI_PROMPT.s())) {
            system.setPrompt(node.getStr(NodeProp.AI_PROMPT.s()));
        }

        if (StringUtils.isEmpty(system.getService()) && node.hasProp(NodeProp.AI_SERVICE.s())) {
            system.setService(node.getStr(NodeProp.AI_SERVICE.s()));
        }

        if (StringUtils.isEmpty(system.getTemplate()) && node.hasProp(NodeProp.AI_QUERY_TEMPLATE.s())) {
            system.setTemplate(node.getStr(NodeProp.AI_QUERY_TEMPLATE.s()));
        }

        if (system.getMaxWords() == null && node.hasProp(NodeProp.AI_MAX_WORDS.s())) {
            system.setMaxWords(Integer.valueOf(node.getStr(NodeProp.AI_MAX_WORDS.s())));
        }
    }

    public boolean isAnyAnswerType(String type) {
        return NodeType.OPENAI_ANSWER.s().equals(type) || //
                NodeType.PPLXAI_ANSWER.s().equals(type) || //
                NodeType.GEMINIAI_ANSWER.s().equals(type) || //
                NodeType.ANTHAI_ANSWER.s().equals(type);
    }

    public void getAIConfigFromAncestorNodes(MongoSession ms, SubNode node, SystemConfig system) {
        while (node != null) {
            parseAIConfig(node, system);
            node = read.getParent(ms, node);
        }
    }

    public BigDecimal getBalance(MongoSession ms, SubNode userNode) {
        BigDecimal balance = null;
        String userName = userNode.getStr(NodeProp.USER);
        if (user.initialGrant(userNode.getIdStr(), userName)) {
            balance = new BigDecimal(UserManagerService.INITIAL_GRANT_AMOUNT);
        } else {
            balance = tranRepository.getBalByMongoId(ms.getUserNodeId().toHexString());
            if (balance == null) {
                throw new RuntimeException("Sorry, you have no more credit.");
            }
            int comparisonResult = balance.compareTo(BigDecimal.ZERO);
            if (comparisonResult <= 0) {
                throw new RuntimeException("Sorry, you have no more credit.");
            }
        }
        return balance;
    }

    // updates the user's credit, and returns new balance
    public BigDecimal updateUserCredit(SubNode userNode, BigDecimal curBal, BigDecimal cost, String serviceCode) {
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
        debit.setDescCode(serviceCode);
        debit.setUserAccount(user);

        // Eventually we will add to this information about the gpt request too. Entire Q & A
        // debit.setDetail(mapper.valueToTree(res));

        tranRepository.save(debit);
        return curBal.subtract(cost);
    }

    public AskSubGraphResponse askSubGraph(MongoSession ms, AskSubGraphRequest req) {
        AskSubGraphResponse res = new AskSubGraphResponse();

        // todo-2: in future use cases we'd want to allow includeComments setting
        List<SubNode> nodes = read.getFlatSubGraph(ms, req.getNodeId(), true);
        int counter = 0;
        StringBuilder sb = new StringBuilder();
        SubNode node = read.getNode(ms, req.getNodeId());

        sb.append("Here is some context infomration:\n");
        sb.append(node.getContent() + "\n\n");
        SystemConfig system = new SystemConfig();

        for (SubNode n : nodes) {
            // if we have filter IDs and this node isn't in the filter, skip it
            if (req.getNodeIds() != null && !req.getNodeIds().contains(n.getIdStr())) {
                continue;
            }

            aiUtil.parseAIConfig(node, system);
            sb.append(n.getContent() + "\n\n");
            counter++;

            if (!ms.isAdmin()) {
                // we can remove these limitations once we have user quotas in place.
                if (counter > 100) {
                    throw new RuntimeException("Too many nodes in subgraph.");
                }
                if (sb.length() > 32000) {
                    throw new RuntimeException("Too many characters in subgraph.");
                }
            }
        }
        sb.append("Here is my question:\n");
        sb.append(req.getQuestion());

        ChatCompletionResponse answer = null;
        AnthChatResponse anthAnswer = null;
        GeminiChatResponse geminiAnswer = null;
        AIServiceName svc = AIServiceName.fromString(req.getAiService());
        if (svc != null) {
            switch (svc) {
                case OPENAI:
                    answer = oai.getAnswer(ms, null, sb.toString(), system);
                    break;
                case PPLX:
                    answer = pplxai.getAnswer(ms, null, sb.toString(), system, pplxai.PPLX_MODEL_COMPLETION_CHAT);
                    break;
                case ANTH:
                    anthAnswer =
                            anthai.getAnswer(ms, null, sb.toString(), system, anthai.ANTH_OPUS_MODEL_COMPLETION_CHAT);
                    break;
                case ANTH_SONNET:
                    anthAnswer =
                            anthai.getAnswer(ms, null, sb.toString(), system, anthai.ANTH_SONNET_MODEL_COMPLETION_CHAT);
                    break;
                case PPLX_ONLINE:
                    answer = pplxai.getAnswer(ms, null, sb.toString(), system, pplxai.PPLX_MODEL_COMPLETION_ONLINE);
                    break;
                case PPLX_CODE_LLAMA:
                    answer = pplxai.getAnswer(ms, null, sb.toString(), system, pplxai.PPLX_MODEL_COMPLETION_CODELLAMA);
                    break;
                case PPLX_MIXTRAL:
                    answer = pplxai.getAnswer(ms, null, sb.toString(), system, pplxai.PPLX_MODEL_COMPLETION_MIXTRAL);
                    break;
                case GEMINI:
                    geminiAnswer = geminiai.getAnswer(ms, null, sb.toString(), system);
                    break;
                default:
                    throw new RuntimeException("Unknown AI service: " + req.getAiService());
            }
        }

        if (answer != null) {
            res.setGptCredit(answer.userCredit);
            res.setAnswer("Q: " + req.getQuestion() + "\n\nA: " + formatAnswer(answer, false));
        } //
        else if (anthAnswer != null) {
            res.setGptCredit(anthAnswer.userCredit);
            res.setAnswer("Q: " + req.getQuestion() + "\n\nA: " + formatAnswer(anthAnswer, false));
        } //
        else if (geminiAnswer != null) {
            res.setGptCredit(geminiAnswer.credit);
            res.setAnswer("Q: " + req.getQuestion() + "\n\nA: " + formatAnswer(geminiAnswer, false));
        } else {
            throw new RuntimeException("No answer from AI service: " + req.getAiService());
        }
        return res;
    }

    public String prepareAIQuestionText(SubNode node, SystemConfig system) {
        String content = node.getContent();
        content = XString.repeatingTrimFromFront(content, "#");
        String input;
        if (!StringUtils.isEmpty(system.getTemplate())) {
            input = system.getTemplate().replace("${content}", content);
        } else {
            input = content;
        }
        if (!StringUtils.isEmpty(system.getPrompt())) {
            input = system.getPrompt() + "\n\n" + input;
        }
        return input;
    }

    public String formatAnswer(ChatCompletionResponse ccr, boolean nullify) {
        StringBuilder sb = new StringBuilder();
        int counter = 0;
        for (Choice choice : ccr.getChoices()) {
            if (counter > 0) {
                sb.append("\n\n");
            }
            sb.append(/* choice.getMessage().getRole() + ": " + */ choice.getMessage().getTextContent());

            // Since we store the answer text in the content of the node and also store the answer object
            // on the node we nullify the content here so it isn't duplicated in the MongoDb storage.
            if (nullify) {
                choice.getMessage().setContent(null);
            }
            counter++;
        }
        return sb.toString();
    }

    public String formatAnswer(AnthChatResponse acr, boolean nullify) {
        StringBuilder sb = new StringBuilder();
        int counter = 0;
        for (AnthChatContent cont : acr.getContent()) {
            if (counter > 0) {
                sb.append("\n\n");
            }
            sb.append(/* choice.getMessage().getRole() + ": " + */ cont.getText());

            // Since we store the answer text in the content of the node and also store the answer object
            // on the node we nullify the content here so it isn't duplicated in the MongoDb storage.
            if (nullify) {
                cont.setText(null);
            }
            counter++;
        }
        return sb.toString();
    }

    public String formatAnswer(GeminiChatResponse ccr, boolean nullify) {
        StringBuilder sb = new StringBuilder();
        int counter = 0;
        for (GeminiChatCandidate choice : ccr.getCandidates()) {
            if (counter > 0) {
                sb.append("\n\n----\n\n");
            }
            GeminiChatContent content = choice.getContent();
            if (content != null && content.getParts() != null && content.getParts().size() > 0) {
                for (GeminiChatPart part : content.getParts()) {
                    sb.append(part.getText() + "\n");
                }
            }

            // Since we store the answer text in the content of the node and also store the answer object
            // on the node we nullify the content here so it isn't duplicated in the MongoDb storage.
            if (nullify) {
                choice.setContent(null);
            }
            counter++;
        }
        return sb.toString();
    }

    public String formatExportAnswerSection(String content, String aiService) {
        return "<div style='border-radius: 8px; border: 2px solid gray; padding: 8px; margin: 8px;'>\n" + content
                + "\n<div style='text-align: right; margin: 6px;'>" + aiService + "</div></div>";
    }
}
