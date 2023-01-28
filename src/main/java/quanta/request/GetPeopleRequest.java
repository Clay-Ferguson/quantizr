package quanta.request;

import quanta.request.base.RequestBase;

public class GetPeopleRequest extends RequestBase {

    // if nodeId is non-null we return only the info for the users associated with that node, whichi 
    // means everyone mentioned in the text plus, everyone in the shares.
	private String nodeId;
    private String type; //  friends | blocks

    public String getNodeId() {
        return nodeId;
    }

    public void setNodeId(String nodeId) {
        this.nodeId = nodeId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}
