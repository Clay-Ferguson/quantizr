package quanta.request;

import quanta.request.base.RequestBase;

public class RenderDocumentRequest extends RequestBase {
    private String rootId;
    private String startNodeId;
    private boolean includeComments;

    public String getRootId() {
        return rootId;
    }

    public void setRootId(String rootId) {
        this.rootId = rootId;
    }

    public String getStartNodeId() {
        return startNodeId;
    }

    public void setStartNodeId(String startNodeId) {
        this.startNodeId = startNodeId;
    }

    public boolean isIncludeComments() {
        return includeComments;
    }

    public void setIncludeComments(boolean includeComments) {
        this.includeComments = includeComments;
    }
}
