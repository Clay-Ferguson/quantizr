
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class GetPeopleRequest extends RequestBase {
    private String nodeId;
    private String type; // friends | blocks

    public String getNodeId() {
        return this.nodeId;
    }

    public String getType() {
        return this.type;
    }

    public void setNodeId(final String nodeId) {
        this.nodeId = nodeId;
    }

    public void setType(final String type) {
        this.type = type;
    }

    public GetPeopleRequest() {}
}
