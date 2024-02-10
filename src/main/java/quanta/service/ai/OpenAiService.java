package quanta.service.ai;

import java.io.InputStream;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import quanta.config.ServiceBase;
import quanta.model.client.Attachment;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.openai.ChatCompletionResponse;
import quanta.model.client.openai.ChatGPTModerationRequest;
import quanta.model.client.openai.ChatGPTModerationResponse;
import quanta.model.client.openai.ChatGPTRequest;
import quanta.model.client.openai.ChatGPTTextModerationItem;
import quanta.model.client.openai.ChatMessage;
import quanta.model.client.openai.ImageGenRequest;
import quanta.model.client.openai.ImageResponse;
import quanta.model.client.openai.SpeechGenRequest;
import quanta.model.client.openai.SystemConfig;
import quanta.model.client.openai.Usage;
import quanta.mongo.CreateNodeLocation;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.CreateSubNodeRequest;
import quanta.response.CreateSubNodeResponse;
import quanta.service.AppController;
import quanta.util.Const;
import quanta.util.LimitedInputStreamEx;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import quanta.util.XString;
import reactor.core.publisher.Mono;

@Component
public class OpenAiService extends ServiceBase {
    String OPENAI_MOD_URL = "https://api.openai.com/v1/moderations";
    String OPENAI_COMP_URL = "https://api.openai.com/v1/chat/completions";
    String OPENAI_IMAGE_GEN_URL = "https://api.openai.com/v1/images/generations";
    String OPENAI_SPEECH_GEN_URL = "https://api.openai.com/v1/audio/speech";

    // Warning: If you change these, you will need to update the pricing calculations
    String OPENAI_MODEL_TTS = "tts-1";
    String OPENAI_MODEL_VISION = "gpt-4-vision-preview";
    String OPENAI_MODEL_COMPLETION = "gpt-4-1106-preview";
    String COST_CODE = "OAI"; // 3 chars allowed

    DecimalFormat decimalFormatter = new DecimalFormat("0.##########");
    private static Logger log = LoggerFactory.getLogger(OpenAiService.class);

    public String generateSpeech(MongoSession ms, String prompt, String voice, String nodeId) {
        SubNode userNode = read.getAccountByUserName(ms, ms.getUserName(), false);
        if (userNode == null) {
            throw new RuntimeException("Unknown user.");
        }

        BigDecimal balance = aiUtil.getBalance(ms, userNode);
        LimitedInputStreamEx lis = null;
        String model = OPENAI_MODEL_TTS;

        try {
            WebClient webClient = Util.webClientBuilder().baseUrl(OPENAI_SPEECH_GEN_URL)
                    .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .defaultHeader("Authorization", "Bearer " + prop.getOpenAiKey()).build();

            SpeechGenRequest request = new SpeechGenRequest(model, prompt, voice);
            Mono<DataBuffer> mono = webClient.post().body(BodyInserters.fromValue(XString.prettyPrint(request)))
                    .retrieve().bodyToMono(DataBuffer.class);
            DataBuffer dataBuffer = mono.block();
            if (dataBuffer != null) {
                InputStream is = dataBuffer.asInputStream();

                if (is == null) {
                    throw new RuntimeException("Error generating speech.");
                }

                lis = new LimitedInputStreamEx(is, 100 * Const.ONE_MB);
                try {
                    SubNode node = read.getNode(ms, nodeId);
                    if (node != null) {
                        int attIdx = node.getAttachments() != null ? node.getAttachments().size() : 0;
                        attach.saveBinaryStreamToNode(ms, false, "p" + attIdx, lis, "audio/mpeg", "file.mp3", //
                                0L, 0, 0, node, false, false, false, //
                                true, null, null);
                    }
                } finally {
                    lis.close();
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Error generating speech: " + e.getMessage());
        }

        // NOTE: DO NOT DELETE. Useful for troubleshooting.
        // String response = webClient.post().body(BodyInserters.fromValue(XString.prettyPrint(request)))
        // .accept(MediaType.APPLICATION_JSON).retrieve().bodyToMono(String.class).block();
        // log.debug("Image RESPONSE: " + response);

        if (lis != null) {
            BigDecimal cost = getSpeechCost(model, prompt.length());
            aiUtil.updateUserCredit(userNode, balance, cost, COST_CODE);
        }
        return null;
    }

    public String generateImage(MongoSession ms, String prompt, boolean highDef, String size) {
        SubNode userNode = read.getAccountByUserName(ms, ms.getUserName(), false);
        if (userNode == null) {
            throw new RuntimeException("Unknown user.");
        }

        BigDecimal balance = aiUtil.getBalance(ms, userNode);
        ImageResponse res = null;

        try {
            WebClient webClient = Util.webClientBuilder().baseUrl(OPENAI_IMAGE_GEN_URL)
                    .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .defaultHeader("Authorization", "Bearer " + prop.getOpenAiKey()).build();

            // WARNING: If you alter the size of the image, you will need to update the pricing calculations
            ImageGenRequest request = new ImageGenRequest("dall-e-3", prompt, 1, size, highDef ? "hd" : null);

            Mono<ImageResponse> mono = webClient.post().body(BodyInserters.fromValue(XString.prettyPrint(request)))
                    .retrieve().bodyToMono(ImageResponse.class);
            res = mono.block();
        } catch (Exception e) {
            log.error("Error generating image: " + e.getMessage());
            throw e;
        }

        // NOTE: DO NOT DELETE. Useful for troubleshooting.
        // String response = webClient.post().body(BodyInserters.fromValue(XString.prettyPrint(request)))
        // .accept(MediaType.APPLICATION_JSON).retrieve().bodyToMono(String.class).block();
        // log.debug("Image RESPONSE: " + response);

        if (res.getData() != null && res.getData().size() > 0) {
            return res.getData().get(0).getUrl();
        }

        BigDecimal cost = getImageCost(size);
        aiUtil.updateUserCredit(userNode, balance, cost, COST_CODE);
        return null;
    }

    // https://openai.com/pricing
    private BigDecimal getImageCost(String size) {
        switch (size) {
            case "1024x1792":
            case "1792x1024":
                return new BigDecimal(0.01105);
            case "1024x1024":
                return new BigDecimal(0.00765);
            default:
                throw new RuntimeException("Unsupported image size: " + size);
        }
    }

    private BigDecimal getSpeechCost(String model, int promptLength) {
        switch (model) {
            case "tts-1":
                return new BigDecimal(0.000015 * promptLength);
            default:
                throw new RuntimeException("Unsupported speech model: " + model);
        }
    }

    /**
     * Queries OpenAI using the 'node.content' as the question to ask.
     * 
     * You can pass a node, or else 'text' to query about.
     */
    public ChatCompletionResponse getAnswer(MongoSession ms, SubNode node, String question, SystemConfig system) {
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

        if (!system.isConfigured()) {
            system.setPrompt("You are a helpful assistant, who will answer questions about the following information:");
        }

        String input = node != null ? node.getContent() : question;
        List<Map> sysContent = new ArrayList<>();
        HashMap<String, Object> map = new HashMap<>();
        map.put("type", "text");
        map.put("text", system.getPrompt());
        sysContent.add(map);
        messages.add(0, new ChatMessage("system", sysContent));

        List<Map> content = new ArrayList<>();
        map = new HashMap<>();
        map.put("type", "text");
        map.put("text", input);
        content.add(map);
        addAttachments(content, node);
        messages.add(new ChatMessage("user", content));

        // Select gpt-4 model based on whether the question contains images
        if (messageListHasImages(messages)) {
            system.setModel(OPENAI_MODEL_VISION);
        } else {
            system.setModel(OPENAI_MODEL_COMPLETION);
        }

        /* Moderate Call before submitting */
        String contentToModerate = concatenateContent(messages);

        ChatGPTModerationRequest modRequest = new ChatGPTModerationRequest(contentToModerate);

        WebClient webClient =
                Util.webClientBuilder().defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                        .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + prop.getOpenAiKey())
                        .baseUrl(OPENAI_MOD_URL).build();

        Mono<ChatGPTModerationResponse> modResponse =
                webClient.post().body(Mono.just(modRequest), ChatGPTModerationRequest.class).retrieve()
                        .bodyToMono(ChatGPTModerationResponse.class);

        ChatGPTModerationResponse modRes = modResponse.block();

        if (moderationFailed(modRes)) {
            throw new RuntimeException("Sorry, the AI would reject that question.");
        }

        webClient = Util.webClientBuilder().baseUrl(OPENAI_COMP_URL)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("Authorization", "Bearer " + prop.getOpenAiKey()).build();

        /*
         * Without maxTokens we get comically short answers (like not even the complete first sentence of
         * the response, but a sentence frament), so I'm not sure what to do about if or how end users
         * should be able to tweak this. Before switching to gpt-4 vision we were getting sensible response
         * lengths without having to provide a maxTokens value
         */
        ChatGPTRequest request = new ChatGPTRequest(system.getModel(), messages, system.getTemperature(),
                ms.getUserNodeId().toHexString(), 2000);

        log.debug("GPT Req: USER: " + ms.getUserName() + " AI MODEL: " + system.getModel() + ": "
                + XString.prettyPrint(request));

        /*
         * Prior to tweaking the Models to support the new GPT-4 we had been able to just use 'request' here
         * instead of the stringified version of it. I haven't tried to figure out why the non-stringified
         * fails, but it does fail.
         */
        Mono<ChatCompletionResponse> mono = webClient.post().body(BodyInserters.fromValue(XString.prettyPrint(request)))
                .retrieve().bodyToMono(ChatCompletionResponse.class);

        ChatCompletionResponse res = mono.block();
        BigDecimal cost = new BigDecimal(calculateCost(res));
        res.userCredit = aiUtil.updateUserCredit(userNode, balance, cost, COST_CODE);
        log.debug("GPT Res: " + XString.prettyPrint(res));
        return res;

        // ================================
        // DO NOT DELETE:
        // We can use this for debugging to see the raw request and response
        // String response = webClient.post().body(BodyInserters.fromValue(XString.prettyPrint(request)))
        // .accept(MediaType.APPLICATION_JSON).retrieve().bodyToMono(String.class).block();
        // log.debug("RESPONSE: " + response);
    }

    private boolean messageListHasImages(List<ChatMessage> messages) {
        for (ChatMessage cm : messages) {
            if (chatContentHasImages(cm.getContent())) {
                return true;
            }
        }
        return false;
    }

    // Object will be "string" or {type, text, image_url}
    private boolean chatContentHasImages(Object content) {
        if (content instanceof String) {
            return false;
        }
        if (content instanceof List contentList) {
            for (Object c : contentList) {
                if (c instanceof Map cMap) {
                    if ("image_url".equals(cMap.get("type"))) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private void addAttachments(List<Map> content, SubNode node) {
        if (node == null)
            return;
        if (node.getAttachments() != null) {
            node.getAttachments().forEach((String key, Attachment att) -> {
                if (att.getMime().startsWith("image")) {
                    // add url if the attachment is a simple url
                    if (att.getUrl() != null) {
                        HashMap<String, Object> map = new HashMap<>();
                        map.put("type", "image_url");
                        map.put("image_url", att.getUrl());
                        content.add(map);
                    }
                    // otherwise build the link to our server if the image is stored on the server DB
                    else if (att.getBin() != null) {
                        String path = AppController.API_PATH + "/bin/" + att.getBin() + "?nodeId=" + node.getIdStr()
                                + "&token="
                                + URLEncoder.encode(ThreadLocals.getSC().getUserToken(), StandardCharsets.UTF_8);
                        String src = prop.getProtocolHostAndPort() + path;
                        HashMap<String, Object> map = new HashMap<>();
                        map.put("type", "image_url");
                        map.put("image_url", src);
                        content.add(map);
                    }
                }
            });
        }
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
            result.append(messages.get(i).getTextContent());
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
        aiUtil.parseAISystemFromContent(node, system);
        SubNode parent = read.getParent(ms, node);
        int nonAnswerCounter = aiUtil.isAnyAnswerType(parent.getType()) ? 0 : 1;

        // this while loop should encounter alternating questions and answer nodes as we go back up
        // the tree building history.
        while (parent != null) {
            if (aiUtil.isAnyAnswerType(parent.getType())) {
                nonAnswerCounter = 0;
                List<Map> content = new ArrayList<>();
                HashMap<String, Object> map = new HashMap<>();
                map.put("type", "text");
                map.put("text", parent.getContent());
                content.add(map);
                messages.add(0, new ChatMessage("assistant", content));
            } else {
                nonAnswerCounter++;
                aiUtil.parseAISystemFromContent(parent, system);

                // if we hit two non-answer nodes in a row that means we're at the top level of
                // where teh first question was asked, and therefore the beginning of the chat.
                if (nonAnswerCounter > 1) {
                    break;
                }

                List<Map> content = new ArrayList<>();
                HashMap<String, Object> map = new HashMap<>();
                map.put("type", "text");
                map.put("text", parent.getContent());
                content.add(map);
                addAttachments(content, parent);
                messages.add(0, new ChatMessage("user", content));
            }

            // walk up the tree. get parent of parent.
            parent = read.getParent(ms, parent);
        }

        // if we still don't have a system prompt check all ancestor nodes
        aiUtil.getSystemPromptFromAncestorNodes(ms, parent, system);
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
            // https://openai.com/pricing
            inputPpk = 0.01;
            outputPpk = 0.03;
        } else {
            throw new RuntimeException("Only gpt-4-* is currently supported. " + res.getModel() + " is not supported.");
        }
        return (usage.getPromptTokens() * inputPpk / 1000) + (usage.getCompletionTokens() * outputPpk / 1000);
    }

    // Assumes node is a question, and inserts the answer under it as a subnode
    public void insertAnswerToQuestion(MongoSession ms, SubNode node, CreateSubNodeRequest req,
            CreateSubNodeResponse res) {

        ChatCompletionResponse aiAnswer = oai.getAnswer(ms, node, null, null);
        res.setGptCredit(aiAnswer.userCredit);

        SubNode newNode = create.createNode(ms, node, null, NodeType.OPENAI_ANSWER.s(), 0L, CreateNodeLocation.FIRST,
                null, null, true, true, res.getNodeChanges());

        newNode.setContent(aiUtil.formatAnswer(aiAnswer, true));
        newNode.set(NodeProp.OPENAI_RESPONSE, aiAnswer);

        newNode.touch();
        newNode.set(NodeProp.TYPE_LOCK, Boolean.valueOf(true));
        acl.inheritSharingFromParent(ms, res, node, newNode);
        update.save(ms, newNode);
    }
}
