package quanta.response;

import quanta.response.base.NodeChanges;
import quanta.response.base.ResponseBase;

public class SetNodePositionResponse extends ResponseBase {
    private NodeChanges nodeChanges;

    public NodeChanges getNodeChanges() {
        return nodeChanges;
    }

    public void setNodeChanges(NodeChanges nodeChanges) {
        this.nodeChanges = nodeChanges;
    }
}
