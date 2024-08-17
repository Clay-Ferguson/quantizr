
package quanta.rest.response;

import quanta.rest.response.base.NodeChanges;
import quanta.rest.response.base.ResponseBase;

public class MoveNodesResponse extends ResponseBase {
    private boolean signaturesRemoved;
    private NodeChanges nodeChanges;

    public boolean isSignaturesRemoved() {
        return this.signaturesRemoved;
    }

    public void setSignaturesRemoved(final boolean signaturesRemoved) {
        this.signaturesRemoved = signaturesRemoved;
    }

    public NodeChanges getNodeChanges() {
        return nodeChanges;
    }

    public void setNodeChanges(NodeChanges nodeChanges) {
        this.nodeChanges = nodeChanges;
    }

    public MoveNodesResponse() {}
}
