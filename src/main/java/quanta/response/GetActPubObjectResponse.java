package quanta.response;

import quanta.response.base.ResponseBase;
import quanta.model.NodeInfo;

public class GetActPubObjectResponse extends ResponseBase {
    private NodeInfo node;

    public NodeInfo getNode() {
        return node;
    }

    public void setNode(NodeInfo node) {
        this.node = node;
    }
}
