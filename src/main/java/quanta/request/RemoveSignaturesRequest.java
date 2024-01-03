
package quanta.request;

import quanta.request.base.RequestBase;

public class RemoveSignaturesRequest extends RequestBase {
    private String nodeId;

    public RemoveSignaturesRequest() {}

    public String getNodeId() {
        return this.nodeId;
    }

    public void setNodeId(final String nodeId) {
        this.nodeId = nodeId;
    }
}
