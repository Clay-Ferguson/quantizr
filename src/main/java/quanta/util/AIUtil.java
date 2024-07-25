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
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.core.type.TypeReference;
import quanta.config.ServiceBase;
import quanta.model.client.AIModels;
import quanta.model.client.NodeProp;
import quanta.model.client.openai.SystemConfig;
import quanta.model.qai.AIResponse;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
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

    public void parseAIConfig(MongoSession ms, SubNode node, SystemConfig system) {
        if (StringUtils.isEmpty(system.getPrompt()) && node.hasProp(NodeProp.AI_PROMPT.s())) {
            system.setPrompt(node.getStr(NodeProp.AI_PROMPT.s()));
        }

        if (StringUtils.isEmpty(system.getService()) && node.hasProp(NodeProp.AI_SERVICE.s())) {
            system.setService(node.getStr(NodeProp.AI_SERVICE.s()));
        }

        if (StringUtils.isEmpty(system.getTemplate()) && node.hasProp(NodeProp.AI_QUERY_TEMPLATE.s())) {
            String queryTemplate = node.getStr(NodeProp.AI_QUERY_TEMPLATE.s());
            queryTemplate = preProcessTemplate(ms, node, queryTemplate);
            system.setTemplate(queryTemplate);
        }

        if (system.getMaxWords() == null && node.hasProp(NodeProp.AI_MAX_WORDS.s())) {
            system.setMaxWords(Integer.valueOf(node.getStr(NodeProp.AI_MAX_WORDS.s())));
        }

        if (system.getTemperature() == null && node.hasProp(NodeProp.AI_TEMPERATURE.s())) {
            system.setTemperature(Double.valueOf(node.getStr(NodeProp.AI_TEMPERATURE.s())));
        }
    }

    public String preProcessTemplate(MongoSession ms, final SubNode node, String template) {
        if (template == null) {
            return null;
        }

        SubNode firstParent = null;

        // we want ${bookContext} to turn into:
        // Book Title: ${bookTitle}
        // Chapter Title: ${chapterTitle}
        // Section Title: ${sectionTitle}
        // Subsection Title: ${subsectionTitle}
        // by starting at this node's parent and walking up the tree to the root document.
        if (template.contains("${bookContext}")) {
            String bookContext = "\n";
            SubNode parent = read.getParent(ms, node);
            while (parent != null) {
                if (firstParent == null) {
                    firstParent = parent;
                }

                if (parent.getTags() != null) {
                    // get parent with any markdown headings stripped off
                    String parentContent = XString.repeatingTrimFromFront(parent.getContent(), "#").trim();

                    if (parent.getTags().contains("#book")) {
                        bookContext = "Book Title: " + parentContent + "\n" + bookContext;
                        // break. we're done if we reach the book node.
                        break;
                    } else if (parent.getTags().contains("#chapter")) {
                        bookContext = "Chapter Title: " + parentContent + "\n" + bookContext;
                    } else if (parent.getTags().contains("#section")) {
                        bookContext = "Section Title: " + parentContent + "\n" + bookContext;
                    } else if (parent.getTags().contains("#subsection")) {
                        bookContext = "Subsection Title: " + parentContent + "\n" + bookContext;
                    }
                }
                parent = read.getParent(ms, parent);
            }

            template = template.replace("${bookContext}", "\n" + bookContext + "\n");

            // DO NOT DELETE. KEEP THIS EXPERIMENTAL CODE FOR FUTURE REFERENCE.
            //
            /*
             * I had originally used the code below to try to have an "insert here" capability but at least
             * ChatGPT (not necessarily other AI services) didn't handle this well, so we're no longer doing
             * this.
             * 
             * LLM PROMPT:
             * 
             * You are an author helping me write a book. You will look at the Book Title, Chapter Title,
             * Section Title and/or Subsection Titles provided, to understand which piece of the book you are
             * writing, and you will generate a paragraph of content, as the proposed paragraph belonging in
             * that section of the book.
             * 
             * If you are given `EXISTING PARAGRAPHS`, then you will generate your new paragraph of content so
             * that it logically fits into where ${insertContentHere} appears inside the existing paragraphs, to
             * create the content that would belong there (at the ${insertContentHere} location); otherwise, if
             * there is no `EXISTING PARAGRAPHS` text provided, then assume you will be writing the first
             * paragraph (rather than inserting a paragraph), based on the Chapter, Section, and/or Subsection.
             * 
             * <end of prompt>
             */
            // Iterable<SubNode> children = read.getChildren(ms, firstParent, Sort.by(Sort.Direction.ASC,
            // SubNode.ORDINAL),
            // null, 0, null, false);
            // if (children != null) {
            // StringBuilder sb = new StringBuilder();
            // for (SubNode child : children) {
            // if (child.getId().equals(node.getId())) {
            // sb.append("${insertContentHere}\n\n");
            // } else {
            // sb.append(child.getContent() + "\n\n");
            // }
            // }
            // template += "\n\nEXISTING PARAGRAPHS:\n" + sb.toString();
            // }
        }

        return template;
    }

    public void getAIConfigFromAncestorNodes(MongoSession ms, SubNode node, SystemConfig system) {
        while (node != null) {
            parseAIConfig(ms, node, system);
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
    @Transactional("transactionManager")
    public BigDecimal updateUserCredit(SubNode userNode, BigDecimal curBal, BigDecimal cost, String serviceCode) {
        UserAccount user = userRepository.findByMongoId(userNode.getIdStr());

        if (user == null) {
            // creating here should never be necessary but we do it anyway
            log.debug("User not found, creating...");
            String userName = userNode.getStr(NodeProp.USER);
            user = userRepository.save(new UserAccount(userNode.getIdStr(), userName));
            userRepository.flush();
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

    public AskSubGraphResponse cm_askSubGraph(MongoSession ms, AskSubGraphRequest req) {
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
            if (req.getNodeIds() != null && req.getNodeIds().size() > 0 && !req.getNodeIds().contains(n.getIdStr())) {
                continue;
            }

            aiUtil.parseAIConfig(ms, node, system);
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
        if (counter==0) {
            throw new RuntimeException("No context for this query was able to be created.");
        }

        sb.append("Here is my question:\n");
        sb.append(req.getQuestion());

        Val<BigDecimal> userCredit = new Val<>(BigDecimal.ZERO);
        AIResponse aiResponse = null;
        AIModels svc = AIModels.fromString(req.getAiService());
        if (svc.getService() == "gemini") {
            throw new RuntimeException("Gemini AI is temporarily unavailable.");
        }
        aiResponse = ai.getAnswer(ms, null, sb.toString(), system, svc.getModel(), svc.getService(), userCredit);

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
        String content = node.getContent();
        content = XString.repeatingTrimFromFront(content, "#");
        String input;
        if (!StringUtils.isEmpty(system.getTemplate())) {
            input = system.getTemplate().replace("${content}", content);
        } else {
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

    public GenerateBookByAIResponse cm_generateBookByAI(MongoSession ms, GenerateBookByAIRequest req) {
        GenerateBookByAIResponse res = new GenerateBookByAIResponse();

        // node that will be the parent of the book
        SubNode parentNode = read.getNode(ms, req.getNodeId());
        auth.ownerAuth(ms, parentNode);

        Val<BigDecimal> userCredit = new Val<>(BigDecimal.ZERO);
        AIResponse aiResponse = null;
        AIModels svc = AIModels.fromString(req.getAiService());
        if (svc != null) {
            // First scan up the tree to see if we have a svc on the tree and if so use it instead.
            SystemConfig system = new SystemConfig();
            aiUtil.getAIConfigFromAncestorNodes(ms, parentNode, system);
            if (system.getService() != null) {
                svc = AIModels.fromString(system.getService());
            }

            String prompt = req.getPrompt();

            if (StringUtils.isEmpty(prompt)) {
                throw new RuntimeException("Book description is required.");
            }

            if (!prompt.trim().endsWith(".")) {
                prompt = prompt.trim() + ". ";
            }
            prompt += "I want to have " + req.getNumChapters() + " chapters in this book.\n";

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

            if (svc.getService() == "gemini") {
                throw new RuntimeException("Gemini AI is temporarily unavailable.");
            }
            aiResponse = ai.getAnswer(ms, null, prompt, null, svc.getModel(), svc.getService(), userCredit);
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
                SubNode newNode = edit.traverseToC(ms, map, parentNode, req.getPrompt());

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
    // public void insertAnswerToQuestion(MongoSession ms, SubNode node, CreateSubNodeRequest req,
    //         CreateSubNodeResponse res) {

    //     Val<BigDecimal> userCredit = new Val<>(BigDecimal.ZERO);
    //     AIResponse aiResponse = null;
    //     AIModels svc = AIModels.fromString(req.getAiService());
    //     if (svc.getService() == "gemini") {
    //         throw new RuntimeException("Gemini AI is temporarily unavailable.");
    //     }
    //     SystemConfig system = new SystemConfig();
    //     aiUtil.getAIConfigFromAncestorNodes(ms, node, system);
    //     aiResponse = ai.getAnswer(ms, node, null, system, svc.getModel(), svc.getService(), userCredit);

    //     List<PropertyInfo> props = Arrays.asList(new PropertyInfo(NodeProp.AI_SERVICE.s(), req.getAiService()));
    //     SubNode newNode = create.createNode(ms, node, null, NodeType.AI_ANSWER.s(), 0L, CreateNodeLocation.FIRST, props,
    //             null, true, true, res.getNodeChanges());

    //     newNode.setContent(aiResponse.getContent());

    //     newNode.touch();
    //     newNode.set(NodeProp.TYPE_LOCK, Boolean.valueOf(true));
    //     acl.inheritSharingFromParent(ms, res, node, newNode);
    //     update.save(ms, newNode);
    // }
}

