package quanta.rest.response;

import quanta.rest.response.base.ResponseBase;

public class DeleteNodesResponse extends ResponseBase {
    private String jumpTargetId;
    private String warning;

    public String getJumpTargetId() {
        return jumpTargetId;
    }

    public void setJumpTargetId(String jumpTargetId) {
        this.jumpTargetId = jumpTargetId;
    }

    public String getWarning() {
        return warning;
    }

    public void setWarning(String warning) {
        this.warning = warning;
    }

    public DeleteNodesResponse() {
    }
}
