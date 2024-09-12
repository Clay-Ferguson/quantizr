package quanta.util;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.core.type.TypeReference;
import quanta.config.ServiceBase;
import quanta.model.AIResponse;
import quanta.model.client.AIModel;
import quanta.model.client.NodeProp;
import quanta.model.client.SystemConfig;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;
import quanta.postgres.PgTranMgr;
import quanta.postgres.table.Tran;
import quanta.postgres.table.UserAccount;
import quanta.rest.request.AskSubGraphRequest;
import quanta.rest.request.GenerateBookByAIRequest;
import quanta.rest.response.AskSubGraphResponse;
import quanta.rest.response.GenerateBookByAIResponse;
import quanta.service.UserManagerService;
import quanta.util.val.Val;

@Component
public class AIUtil extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(AIUtil.class);

    public void ensureDefaults(SystemConfig system) {
        if (system.getTemperature() == null) {
            system.setTemperature(0.7);
        }
    }

    public void parseAIConfig(SubNode node, SystemConfig system) {
        if (StringUtils.isEmpty(system.getPrompt()) && node.hasProp(NodeProp.AI_PROMPT.s())) {
            system.setPrompt(node.getStr(NodeProp.AI_PROMPT.s()));
        }

        if (StringUtils.isEmpty(system.getFoldersToInclude()) && node.hasProp(NodeProp.AI_FOLDERS_TO_INCLUDE.s())) {
            system.setFoldersToInclude(node.getStr(NodeProp.AI_FOLDERS_TO_INCLUDE.s()));
        }

        if (StringUtils.isEmpty(system.getFileExtensions()) && node.hasProp(NodeProp.AI_FILE_EXTENSIONS.s())) {
            system.setFileExtensions(node.getStr(NodeProp.AI_FILE_EXTENSIONS.s()));
        }

        if (StringUtils.isEmpty(system.getService()) && node.hasProp(NodeProp.AI_SERVICE.s())) {
            system.setService(node.getStr(NodeProp.AI_SERVICE.s()));
        }

        if (StringUtils.isEmpty(system.getTemplate()) && node.hasProp(NodeProp.AI_QUERY_TEMPLATE.s())) {
            String queryTemplate = node.getStr(NodeProp.AI_QUERY_TEMPLATE.s());
            queryTemplate = removeHtmlComments(queryTemplate);
            queryTemplate = injectTemplateContext(node, queryTemplate);

            // When we set this, that means this will be the FINAL format for the question, also we're in writing mode here
            system.setTemplate(queryTemplate);
        }

        if (system.getMaxWords() == null && node.hasProp(NodeProp.AI_MAX_WORDS.s())) {
            system.setMaxWords(Integer.valueOf(node.getStr(NodeProp.AI_MAX_WORDS.s())));
        }

        if (system.getTemperature() == null && node.hasProp(NodeProp.AI_TEMPERATURE.s())) {
            system.setTemperature(Double.valueOf(node.getStr(NodeProp.AI_TEMPERATURE.s())));
        }
    }

    // todo-0: add to documentation that this is a feature.
    public String removeHtmlComments(String val) {
        if (val == null) {
            return null;
        }
        return val.replaceAll("(?s)<!--.*?-->", "");
    }

    public String injectTemplateContext(SubNode node, String prompt) {
        if (prompt == null) {
            return null;
        }

        SubNode parent = svc_mongoRead.getParent(node);
        String context = null;
        if (svc_aiUtil.hasBookTags(parent)) {
            context = insertBookContext(node);
        } else {
            context = insertGeneralContext(node);
        }

        // if we have some context then prepend it to the prompt
        if (!StringUtils.isEmpty(context)) {
            if (prompt.trim().equals("?")) {
                prompt = "Write the content for this section of the document based on the context provided above.";
            }
            prompt = context + prompt;
        }

        log.debug("Prompt with Context: " + prompt);
        return prompt;
    }

    private String insertBookContext(SubNode node) {
        String context = "";
        String instructions =
                "\nTake into consideration the `bookContext` below which lets you know what book, chapter, section, and subsection "
                        + " we're working on. Don't mention anything about the context your reply, just use it for your own information about context.\n"; //

        SubNode parent = svc_mongoRead.getParent(node);
        boolean foundSystemPrompt = false;
        while (parent != null) {
            if (parent.getTags() != null) {
                // get parent with any markdown headings stripped off
                String content = XString.repeatingTrimFromFront(parent.getContent(), "#").trim();

                if (parent.getTags().contains("#book")) {
                    context = "<book-title>\n" + content + "\n</book-title>\n" + context;
                } else if (parent.getTags().contains("#chapter")) {
                    context = "<chapter>\n" + content + "\n</chapter>\n" + context;
                } else if (parent.getTags().contains("#section")) {
                    context = "<section>\n" + content + "\n</section>\n" + context;
                } else if (parent.getTags().contains("#subsection")) {
                    context = "<subsection>\n" + content + "\n</subsection>\n" + context;
                }
            }
            // if parent node has a system prompt we're done
            if (!StringUtils.isEmpty(parent.getStr(NodeProp.AI_PROMPT.s()))) {
                foundSystemPrompt = true;
                break;
            }
            parent = svc_mongoRead.getParent(parent);
        }
        if (foundSystemPrompt) {
            return "<instructions>\n" + instructions + "\n<bookContext>\n" + context
                    + "\n</bookContext>\n</instructions>\n\n";
        }
        return "";
    }

    private String insertGeneralContext(final SubNode node) {
        String context = "";
        String instructions =
                "\nTake into consideration the `context` below (which will contain 'sections' in top-down order from the document hierarchy)"
                        + " which lets you know what sections, subsections, etc. are being written about. "
                        + " Don't mention anything about the context your reply, just use it for your own information about context.\n";
        SubNode parent = svc_mongoRead.getParent(node);
        boolean foundSystemPrompt = false;
        while (parent != null) {
            context = "<section>\n" + parent.getContent() + "\n</section>\n" + context;

            // if parent node has a system prompt we're done
            if (!StringUtils.isEmpty(parent.getStr(NodeProp.AI_PROMPT.s()))) {
                foundSystemPrompt = true;
                break;
            }
            parent = svc_mongoRead.getParent(parent);
        }
        if (foundSystemPrompt) {
            return "<instructions>\n" + instructions + "\n<context>\n" + context + "\n</context>\n</instructions>\n\n";
        }
        return "";
    }

    public void getAIConfigFromAncestorNodes(SubNode node, SystemConfig system) {
        while (node != null) {
            parseAIConfig(node, system);
            node = svc_mongoRead.getParent(node);
        }
    }

    public BigDecimal getBalance(AccountNode userNode) {
        BigDecimal balance = null;
        String userName = userNode.getStr(NodeProp.USER);
        if (svc_pgTrans.initialGrant(userNode.getIdStr(), userName)) {
            balance = new BigDecimal(UserManagerService.INITIAL_GRANT_AMOUNT);
        } else {
            balance = svc_tranRepo.getBalByMongoId(TL.getSC().getUserNodeObjId().toHexString());
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
    public BigDecimal updateUserCredit(AccountNode userNode, BigDecimal curBal, BigDecimal cost, String serviceCode) {
        PgTranMgr.ensureTran();
        UserAccount user = svc_userRepo.findByMongoId(userNode.getIdStr());

        if (user == null) {
            // creating here should never be necessary but we do it anyway
            log.debug("User not found, creating...");
            String userName = userNode.getStr(NodeProp.USER);
            user = svc_userRepo.save(new UserAccount(userNode.getIdStr(), userName));
            svc_userRepo.flush();
        }

        Tran debit = new Tran();
        debit.setAmt(cost);
        debit.setTransType("D");
        debit.setTs(Timestamp.from(Instant.now()));
        debit.setDescCode(serviceCode);
        debit.setUserAccount(user);

        // Eventually we will add to this information about the gpt request too. Entire Q & A
        // debit.setDetail(mapper.valueToTree(res));
        svc_tranRepo.save(debit);
        return curBal.subtract(cost);
    }

    public AskSubGraphResponse cm_askSubGraph(AskSubGraphRequest req) {
        AskSubGraphResponse res = new AskSubGraphResponse();

        // todo-2: in future use cases we'd want to allow includeComments setting
        List<SubNode> nodes = svc_mongoRead.getFlatSubGraph(req.getNodeId(), true);
        int counter = 0;
        StringBuilder sb = new StringBuilder();
        SubNode node = svc_mongoRead.getNode(req.getNodeId());

        sb.append("Here is some context infomration:\n");
        sb.append(node.getContent() + "\n\n");
        SystemConfig system = new SystemConfig();

        for (SubNode n : nodes) {
            // if we have filter IDs and this node isn't in the filter, skip it
            if (req.getNodeIds() != null && req.getNodeIds().size() > 0 && !req.getNodeIds().contains(n.getIdStr())) {
                continue;
            }

            svc_aiUtil.parseAIConfig(node, system);
            sb.append(n.getContent() + "\n\n");
            counter++;

            if (!TL.getSC().isAdmin()) {
                // we can remove these limitations once we have user quotas in place.
                if (counter > 100) {
                    throw new RuntimeException("Too many nodes in subgraph.");
                }
                if (sb.length() > 32000) {
                    throw new RuntimeException("Too many characters in subgraph.");
                }
            }
        }
        if (counter == 0) {
            throw new RuntimeException("No context for this query was able to be created.");
        }

        sb.append("Here is my question:\n");
        sb.append(req.getQuestion());

        Val<BigDecimal> userCredit = new Val<>(BigDecimal.ZERO);
        AIResponse aiResponse = null;
        AIModel svc = AIModel.fromString(req.getAiService());
        aiResponse = svc_ai.getAnswer(false, null, sb.toString(), system, svc, userCredit);

        if (aiResponse != null) {
            res.setGptCredit(userCredit.getVal());
            res.setAnswer("Q: " + req.getQuestion() + "\n\nA: " + aiResponse.getContent());
        } //
        else {
            throw new RuntimeException("No answer from AI service: " + req.getAiService());
        }
        return res;
    }

    public String prepareAIQuestionText(SubNode node, SystemConfig system) {
        String input;

        // NOTE: if we have the template set this is known to be the full prompt, although it used to be
        // used as a template for the prompt
        if (!StringUtils.isEmpty(system.getTemplate())) {
            input = system.getTemplate();
        } else {
            String content = node.getContent();
            content = XString.repeatingTrimFromFront(content, "#");
            input = content;
        }
        return input;
    }

    // public String formatAnswer(ChatCompletionResponse ccr, boolean nullify) {
    // StringBuilder sb = new StringBuilder();
    // int counter = 0;
    // for (Choice choice : ccr.getChoices()) {
    // if (counter > 0) {
    // sb.append("\n\n");
    // }
    // sb.append(/* choice.getMessage().getRole() + ": " + */ choice.getMessage().getTextContent());

    // // Since we store the answer text in the content of the node and also store the answer object
    // // on the node we nullify the content here so it isn't duplicated in the MongoDb storage.
    // if (nullify) {
    // choice.getMessage().setContent(null);
    // }
    // counter++;
    // }
    // return sb.toString();
    // }

    public String formatExportAnswerSection(String content, String aiService) {
        return """
                <div style='border-radius: 8px; border: 2px solid gray; padding: 8px; margin: 8px;'>
                    %s
                    <div style='text-align: right; margin: 6px;'>
                    %s
                    </div>
                </div>
                """.formatted(content, aiService);
    }

    public boolean hasBookTags(SubNode node) {
        return node.getTags() != null && (node.getTags().contains("#book") || node.getTags().contains("#chapter")
                || node.getTags().contains("#section") || node.getTags().contains("#subsection"));
    }

    public GenerateBookByAIResponse cm_generateBookByAI(GenerateBookByAIRequest req) {
        GenerateBookByAIResponse res = new GenerateBookByAIResponse();

        // node that will be the parent of the book
        SubNode parentNode = svc_mongoRead.getNode(req.getNodeId());
       svc_auth.ownerAuth(parentNode);

        Val<BigDecimal> userCredit = new Val<>(BigDecimal.ZERO);
        AIResponse aiResponse = null;
        AIModel svc = AIModel.fromString(req.getAiService());
        if (svc != null) {
            // First scan up the tree to see if we have a svc on the tree and if so use it instead.
            SystemConfig system = new SystemConfig();
            svc_aiUtil.getAIConfigFromAncestorNodes(parentNode, system);
            if (system.getService() != null) {
                svc = AIModel.fromString(system.getService());
            }

            String prompt = req.getPrompt();

            if (StringUtils.isEmpty(prompt)) {
                throw new RuntimeException("Book description is required.");
            }

            if (!prompt.trim().endsWith(".")) {
                prompt = prompt.trim() + ". ";
            }
            prompt += "I want to have " + req.getNumChapters() + " chapters in this book.\n";

            if (req.getNumSections() != null && req.getNumSections() > 0) {
                prompt += "Divide each chapter up into " + req.getNumSections() + " named sections.\n";
            }

            // #ai_prompt
            prompt +=
                    """
                            Each chapter will be subdivided into sections too. Can you suggest the names of those chapters, and under each chapter list the section titles that would appear in that chapter. Also please provide this book index as JSON, so that it can be parsed by machine easily.

                            Here's an example of the kind of JSON you should create:

                            ```json
                            {
                              "title": "From Java to Python: A Transition Guide for Experts",
                              "chapters": [
                                {
                                  "chapter": 1,
                                  "title": "Introduction to Python for Java Developers",
                                  "sections": [
                                    "Comparing Python with Java",
                                    "The Zen of Python",
                                    "Setting up the Python environment",
                                    "Python versions and compatibility",
                                    "Key differences in syntax and design philosophy"
                                  ]
                                },
                                {
                                  "chapter": 2,
                                  "title": "Python Basics: Variables and Data Types",
                                  "sections": [
                                    "Dynamic typing in Python",
                                    "Primitive data types",
                                    "Strings and String manipulation",
                                    "Collections: List, Tuple, Set, Dictionary",
                                    "Type hinting"
                                  ]
                                },
                                {
                                  "chapter": 3,
                                  "title": "Control Flow in Python",
                                  "sections": [
                                    "Indentation-based syntax",
                                    "if, elif, and else statements",
                                    "for and while loops",
                                    "List comprehensions",
                                    "Exception handling differences"
                                  ]
                                },
                                ...other chapters omitted
                              ]
                            }
                            ```
                            """;

            aiResponse = svc_ai.getAnswer(false, null, prompt, null, svc, userCredit);
            res.setGptCredit(userCredit.getVal());
        }
        String answer = aiResponse.getContent();
        log.debug("Generated book content: " + answer);

        String extractedJson = XString.extractFirstJsonCodeBlock(answer);
        log.debug("Extracted JSON: " + extractedJson);
        if (StringUtils.isEmpty(extractedJson)) {
            throw new RuntimeException("AI failed to complete Table of Contents phase.");
        }

        HashMap<String, Object> map = null;
        try {
            map = Util.yamlMapper.readValue(extractedJson, new TypeReference<HashMap<String, Object>>() {});
            log.debug("Parsed JSON: " + XString.prettyPrint(map));
            if (map != null) {
                SubNode newNode = svc_import.traverseToC(map, parentNode, req.getPrompt());

                if (newNode != null) {
                    res.setNodeId(newNode.getIdStr());
                }
            }
        } catch (Exception e) {
            ExUtil.error(log, "failed parsing yaml", e);
        }
        return res;
    }

    // Don't delete this yet, but it probably is no longer used.
    // public void insertAnswerToQuestion(SubNode node, CreateSubNodeRequest req,
    // CreateSubNodeResponse res) {

    // Val<BigDecimal> userCredit = new Val<>(BigDecimal.ZERO);
    // AIResponse aiResponse = null;
    // AIModels svc = AIModels.fromString(req.getAiService());
    // if (svc.getService() == "gemini") {
    // throw new RuntimeException("Gemini AI is temporarily unavailable.");
    // }
    // SystemConfig system = new SystemConfig();
    // aiUtil.getAIConfigFromAncestorNodes(ms, node, system);
    // aiResponse = ai.getAnswer(ms, node, null, system, svc.getModel(), svc.getService(), userCredit);

    // List<PropertyInfo> props = Arrays.asList(new PropertyInfo(NodeProp.AI_SERVICE.s(),
    // req.getAiService()));
    // SubNode newNode = create.createNode(ms, node, null, NodeType.AI_ANSWER.s(), 0L,
    // CreateNodeLocation.FIRST, props,
    // null, true, true, res.getNodeChanges());

    // newNode.setContent(aiResponse.getContent());

    // newNode.touch();
    // newNode.set(NodeProp.TYPE_LOCK, Boolean.valueOf(true));
    // acl.inheritSharingFromParent(ms, res, node, newNode);
    // update.save(ms, newNode);
    // }
}

