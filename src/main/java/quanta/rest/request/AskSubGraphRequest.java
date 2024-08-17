package quanta.rest.request;

import java.util.List;
import quanta.rest.request.base.RequestBase;

public class AskSubGraphRequest extends RequestBase {
    private String nodeId;
    private String question;
    private String aiService;

    // if there are nodes passed in this then it's a filter and we only include them in the input to the
    // AI
    private List<String> nodeIds;

    public List<String> getNodeIds() {
        return nodeIds;
    }

    public void setNodeIds(List<String> nodeIds) {
        this.nodeIds = nodeIds;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getNodeId() {
        return this.nodeId;
    }

    public void setNodeId(String nodeId) {
        this.nodeId = nodeId;
    }

    public String getAiService() {
        return aiService;
    }

    public void setAiService(String aiService) {
        this.aiService = aiService;
    }
}
