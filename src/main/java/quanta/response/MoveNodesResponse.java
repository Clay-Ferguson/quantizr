package quanta.response;

import quanta.response.base.ResponseBase;

public class MoveNodesResponse extends ResponseBase {
    private boolean signaturesRemoved;

    public boolean isSignaturesRemoved() {
        return signaturesRemoved;
    }

    public void setSignaturesRemoved(boolean signaturesRemoved) {
        this.signaturesRemoved = signaturesRemoved;
    }
}

