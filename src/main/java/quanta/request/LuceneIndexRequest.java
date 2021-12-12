package quanta.request;

import quanta.request.base.RequestBase;

public class LuceneIndexRequest extends RequestBase {
    private String nodeId;
    private String path;

    public String getPath() {
        return path;
    }

    public String getNodeId() {
        return nodeId;
    }

    public void setNodeId(String nodeId) {
        this.nodeId = nodeId;
    }

    public void setPath(String path) {
        this.path = path;
    }
}

