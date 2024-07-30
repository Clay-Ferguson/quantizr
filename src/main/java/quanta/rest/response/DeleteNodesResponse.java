package quanta.rest.response;

import quanta.rest.response.base.ResponseBase;

public class DeleteNodesResponse extends ResponseBase {
    private String jumpTargetId;

    public String getJumpTargetId() {
        return jumpTargetId;
    }

    public void setJumpTargetId(String jumpTargetId) {
        this.jumpTargetId = jumpTargetId;
    }

    public DeleteNodesResponse() {
    }
}
