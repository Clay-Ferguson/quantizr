package quanta.response;

import quanta.model.NodeInfo;
import quanta.response.base.ResponseBase;

public class PasteAttachmentsResponse extends ResponseBase {
    private NodeInfo targetNode;

    public NodeInfo getTargetNode() {
        return targetNode;
    }

    public void setTargetNode(NodeInfo targetNode) {
        this.targetNode = targetNode;
    }
}
