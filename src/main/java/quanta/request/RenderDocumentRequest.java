package quanta.request;

import quanta.request.base.RequestBase;

public class RenderDocumentRequest extends RequestBase {
    private String rootId;
    private String startNodeId;

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
}
