package quanta.util;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.core.type.TypeReference;
import quanta.config.ServiceBase;
import quanta.exception.MessageException;
import quanta.exception.NoAgentException;
import quanta.exception.base.RuntimeEx;
import quanta.model.AIResponse;
import quanta.model.client.AIModel;
import quanta.model.client.NodeProp;
import quanta.model.client.SystemConfig;
import quanta.mongo.model.SubNode;
import quanta.rest.request.AskSubGraphRequest;
import quanta.rest.request.GenerateBookByAIRequest;
import quanta.rest.response.AskSubGraphResponse;
import quanta.rest.response.GenerateBookByAIResponse;

@Component
public class AIUtil extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(AIUtil.class);

    public void ensureDefaults(SystemConfig system) {
        if (system.getMaxWords() == null) {
            system.setMaxWords(1000);
        }
        if (system.getTemperature() == null) {
            system.setTemperature(0.7);
        }
    }

    /**
     * Parses the AI configuration from the given node and updates the system configuration accordingly.
     *
     * @param node The node containing the AI configuration properties.
     * @param system The system configuration to be updated.
     * @return true if the AI configuration was successfully parsed and the system configuration was
     *         updated, false otherwise.
     */
    public boolean parseAIConfig(SubNode node, SystemConfig system) {
        // once we've found an agent node we're done looking.
        if (system.getAgentNodeId() != null) {
            return true;
        }

        if (node.hasProp(NodeProp.AI_CONFIG.s())) {
            system.setService(node.getStr(NodeProp.AI_SERVICE.s()));
            system.setAgentNodeId(node.getIdStr());

            String prompt = node.getStr(NodeProp.AI_PROMPT.s());
            prompt = composePrompt(prompt, null);
            system.setSystemPrompt(prompt);
            system.setFoldersToInclude(node.getStr(NodeProp.AI_FOLDERS_TO_INCLUDE.s()));
            system.setFoldersToExclude(node.getStr(NodeProp.AI_FOLDERS_TO_EXCLUDE.s()));
            system.setFileExtensions(node.getStr(NodeProp.AI_FILE_EXTENSIONS.s()));

            String queryTemplate = node.getStr(NodeProp.AI_QUERY_TEMPLATE.s());
            if (!StringUtils.isEmpty(queryTemplate)) {
                queryTemplate = removeHtmlComments(queryTemplate);
                queryTemplate = injectTemplateContext(node, queryTemplate);
                // When we set this, that means this will be the FINAL format for the question, also we're in
                // writing mode here
                system.setTemplate(queryTemplate);
            }

            String maxWords = node.getStr(NodeProp.AI_MAX_WORDS.s());
            try {
                system.setMaxWords(Integer.valueOf(maxWords));
            } catch (Exception e) {
                log.debug("Max Words not a number, setting to 1000.");
                system.setMaxWords(1000);
            }

            String temperature = node.getStr(NodeProp.AI_TEMPERATURE.s());
            try {
                system.setTemperature(Double.valueOf(temperature));
            } catch (Exception e) {
                log.debug("Temperature not a number, setting to 0.7.");
                system.setTemperature(0.7);
            }
            return true;
        }
        return false;
    }

    /**
     * Composes a prompt by processing lines that are enclosed within "::" and replacing them with
     * content generated from a user-specific lookup. The method ensures that there are no duplicate
     * node names in the prompt substitutions.
     *
     * Allows the 'prompt' to have lines formatted like "::nodeName::" which will be replaced with the
     * content of the node with that name. This allows for embedding prompts within prompts. The system
     * is fully composable and can have multiple levels of embedding.
     * 
     * We pass nodeNames, to allow detection of dupliates.
     * 
     * @param prompt The initial prompt string that may contain lines enclosed within "::".
     * @param nodeNames A set of node names to detect duplicates. If null, a new HashSet is created.
     * @return The composed prompt with substitutions made, or the original prompt if no substitutions
     *         were made.
     * @throws MessageException If a duplicate node name is detected in the prompt substitutions.
     */
    public String composePrompt(String prompt, HashSet<String> nodeNames) {
        if (prompt == null)
            return null;
        if (nodeNames == null)
            nodeNames = new HashSet<>();
        // split prompt into multiple lines, by tokenizing on newline
        String[] lines = prompt.split("\n");
        StringBuilder sb = new StringBuilder();
        boolean composed = false;
        for (String line : lines) {
            // if line starts and ends with "::" then extract out the part in between
            if (line.startsWith("::") && line.endsWith("::")) {
                String nodeName = line.substring(2, line.length() - 2);

                // now put the nodeName into the expected format for a user-specific lookup
                nodeName = TL.getSC().getUserName() + ":" + nodeName;

                // add nodeName to nodeNames to detect duplicates and throw exception if it's a duplicate
                if (nodeNames.contains(nodeName)) {
                    throw new MessageException("Duplicate node name in prompt substitutions: [" + nodeName + "]");
                }
                nodeNames.add(nodeName);
                String content = buildSystemPromptFromNode(nodeName);
                composed = true;
                sb.append(content + "\n\n");
            } else {
                sb.append(line + "\n");
            }
        }

        if (!composed) {
            return sb.toString();
        }
        // call again to allow embedding of prompts within prompts
        String ret = composePrompt(sb.toString(), nodeNames);
        return ret;
    }

    /**
     * Builds a system prompt string from the content of a node and its sub-nodes.
     *
     * @param nodeName the name of the node to build the prompt from
     * @return a string containing the concatenated content of the node and its sub-nodes
     * @throws MessageException if the node with the specified name is not found
     */
    public String buildSystemPromptFromNode(String nodeName) {
        StringBuilder sb = new StringBuilder();

        // verify ndoe exists first
        SubNode node = svc_mongoRead.getNodeByName(nodeName, null);
        if (node == null) {
            throw new MessageException("Node name not found: [" + nodeName + "]");
        }

        List<SubNode> nodes = svc_mongoRead.getFlatSubGraph(node.getIdStr(), false, null);
        for (SubNode n : nodes) {
            sb.append(n.getContent() + "\n\n");
        }
        return sb.toString();
    }

    public String removeHtmlComments(String val) {
        if (val == null) {
            return null;
        }
        return val.replaceAll("(?s)<!--.*?-->", "");
    }

    /**
     * Injects context into the given prompt based on the specified node's context.
     *
     * @param node The node for which the context is to be determined.
     * @param prompt The initial prompt to which the context will be prepended.
     * @return The prompt with the context prepended, or null if the prompt is null.
     */
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

    /**
     * Constructs a context string for a given node by traversing its parent nodes and collecting
     * information about the book, chapter, section, and subsection. The context is used to provide
     * additional information for AI processing without explicitly mentioning it in the response.
     *
     * @param node the node for which the context is being constructed
     * @return a formatted string containing instructions and book context if a system prompt is found
     *         in any parent node; otherwise, an empty string
     */
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

    /**
     * Generates a context string for a given node by traversing its parent nodes and collecting their
     * content. The context is used to provide additional information about the sections and subsections
     * in the document hierarchy.
     *
     * @param node The node for which the context is being generated.
     * @return A formatted string containing instructions and context information if a system prompt is
     *         found in any parent node; otherwise, an empty string.
     */
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

    /**
     * Retrieves AI configuration from ancestor nodes of the given node. The method traverses up the
     * node hierarchy until it finds a node with a valid AI configuration or reaches the root node.
     *
     * @param node the starting node from which to begin the search for AI configuration
     * @param system the system configuration object to be populated with AI settings
     */
    public void getAIConfigFromAncestorNodes(SubNode node, SystemConfig system) {
        while (node != null) {
            if (parseAIConfig(node, system))
                break;
            node = svc_mongoRead.getParent(node);
        }
    }

    /**
     * Processes an AskSubGraphRequest to generate a response containing context information and an
     * AI-generated answer.
     *
     * @param req the request containing the node ID and question for which the subgraph context and
     *        answer are needed
     * @return an AskSubGraphResponse containing the AI-generated answer
     * @throws RuntimeEx if there are too many nodes or characters in the subgraph, or if no context can
     *         be created
     * @throws NoAgentException if no AI service is configured
     */
    public AskSubGraphResponse cm_askSubGraph(AskSubGraphRequest req) {
        AskSubGraphResponse res = new AskSubGraphResponse();

        // todo-2: in future use cases we'd want to allow includeComments setting
        List<SubNode> nodes = svc_mongoRead.getFlatSubGraph(req.getNodeId(), true, null);
        int counter = 0;
        StringBuilder sb = new StringBuilder();
        SubNode node = svc_mongoRead.getNode(req.getNodeId());

        sb.append("Here is some context information, to help answer the question below:\n");
        sb.append("<context>\n");
        sb.append(node.getContent() + "\n\n");

        for (SubNode n : nodes) {
            // if we have filter IDs and this node isn't in the filter, skip it
            if (req.getNodeIds() != null && req.getNodeIds().size() > 0 && !req.getNodeIds().contains(n.getIdStr())) {
                continue;
            }

            sb.append(n.getContent() + "\n\n");
            counter++;

            if (!TL.getSC().isAdmin()) {
                // we can remove these limitations once we have user quotas in place.
                if (counter > 100) {
                    throw new RuntimeEx("Too many nodes in subgraph.");
                }
                if (sb.length() > 32000) {
                    throw new RuntimeEx("Too many characters in subgraph.");
                }
            }
        }
        sb.append("</context>\n");
        if (counter == 0) {
            throw new RuntimeEx("No context for this query was able to be created.");
        }

        sb.append("Here is my question:\n");
        sb.append(req.getQuestion());
        AIResponse aiResponse = null;

        SystemConfig system = new SystemConfig();
        AIModel svc = null;
        svc_aiUtil.getAIConfigFromAncestorNodes(node, system);
        if (system.getService() != null) {
            svc = AIModel.fromString(system.getService());
        }
        if (svc == null) {
            throw new NoAgentException();
        }

        aiResponse = svc_ai.getAnswer(false, null, sb.toString(), system, svc);
        if (aiResponse != null) {
            res.setAnswer("Q: " + req.getQuestion() + "\n\nA: " + aiResponse.getContent());
        } else {
            throw new RuntimeEx("No answer from AI");
        }
        return res;
    }

    /**
     * Prepares the AI question text based on the provided node and system configuration.
     *
     * <p>
     * This method generates the input text for an AI question by either using a predefined template
     * from the system configuration or by processing the content of the provided node. If a template is
     * set in the system configuration, it is used as the input text. Otherwise, the content of the node
     * is trimmed of leading '#' characters and used as the input text.
     *
     * @param node the node containing the content to be used for generating the AI question text
     * @param system the system configuration containing the template for the AI question text
     * @return the prepared AI question text
     */
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

    /**
     * Generates a book structure using AI based on the provided request.
     *
     * @param req the request containing the parameters for generating the book
     * @return a response containing the ID of the newly created book node
     * @throws NoAgentException if no AI service is configured
     * @throws RuntimeEx if the book description is missing or if the AI fails to generate the Table of
     *         Contents
     */
    public GenerateBookByAIResponse cm_generateBookByAI(GenerateBookByAIRequest req) {
        GenerateBookByAIResponse res = new GenerateBookByAIResponse();

        // node that will be the parent of the book
        SubNode parentNode = svc_mongoRead.getNode(req.getNodeId());
        svc_auth.ownerAuth(parentNode);

        AIResponse aiResponse = null;
        SystemConfig system = new SystemConfig();
        AIModel svc = null;
        svc_aiUtil.getAIConfigFromAncestorNodes(parentNode, system);
        if (system.getService() != null) {
            svc = AIModel.fromString(system.getService());
        }
        if (svc == null) {
            throw new NoAgentException();
        }

        String prompt = req.getPrompt();

        if (StringUtils.isEmpty(prompt)) {
            throw new RuntimeEx("Book description is required.");
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

        aiResponse = svc_ai.getAnswer(false, null, prompt, null, svc);

        String answer = aiResponse.getContent();
        log.debug("Generated book content: " + answer);

        String extractedJson = XString.extractFirstJsonCodeBlock(answer);
        log.debug("Extracted JSON: " + extractedJson);
        if (StringUtils.isEmpty(extractedJson)) {
            throw new RuntimeEx("AI failed to complete Table of Contents phase.");
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
    // throw new RuntimeEx("Gemini AI is temporarily unavailable.");
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

