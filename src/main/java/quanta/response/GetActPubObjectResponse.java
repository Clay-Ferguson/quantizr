package quanta.response;


import quanta.response.base.ResponseBase;

public class GetActPubObjectResponse extends ResponseBase {
    private String nodeId;

    public String getNodeId() {
        return nodeId;
    }

    public void setNodeId(String nodeId) {
        this.nodeId = nodeId;
    }
}
