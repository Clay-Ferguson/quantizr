package quanta.request;

import quanta.request.base.RequestBase;

public class AskSubGraphRequest extends RequestBase {
    private String nodeId;
    private String question;

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
}
