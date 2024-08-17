package quanta.rest.response;

import quanta.rest.response.base.ResponseBase;

public class ImportJsonResponse extends ResponseBase {
    private String nodeId;

    public ImportJsonResponse() {}

    public String getNodeId() {
        return this.nodeId;
    }

    public void setNodeId(final String nodeId) {
        this.nodeId = nodeId;
    }
}
