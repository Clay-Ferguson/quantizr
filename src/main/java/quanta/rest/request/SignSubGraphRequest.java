
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class SignSubGraphRequest extends RequestBase {
    private String nodeId;
    private boolean signUnsigned;

    public String getNodeId() {
        return this.nodeId;
    }

    public void setNodeId(final String nodeId) {
        this.nodeId = nodeId;
    }

    public boolean isSignUnsigned() {
        return signUnsigned;
    }

    public void setSignUnsigned(boolean signUnsigned) {
        this.signUnsigned = signUnsigned;
    }

    public SignSubGraphRequest() {}
}
