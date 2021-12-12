package quanta.request;

import quanta.request.base.RequestBase;

public class LuceneSearchRequest extends RequestBase {
    private String nodeId;
    private String text;

    public String getNodeId() {
        return nodeId;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public void setNodeId(String nodeId) {
        this.nodeId = nodeId;
    }
}

