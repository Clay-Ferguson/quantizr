package quanta.rest.response;

import quanta.rest.response.base.NodeChanges;
import quanta.rest.response.base.ResponseBase;

public class SetNodePositionResponse extends ResponseBase {
    private NodeChanges nodeChanges;

    public NodeChanges getNodeChanges() {
        return nodeChanges;
    }

    public void setNodeChanges(NodeChanges nodeChanges) {
        this.nodeChanges = nodeChanges;
    }
}
