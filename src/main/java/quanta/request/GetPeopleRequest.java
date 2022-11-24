package quanta.request;

import quanta.request.base.RequestBase;

public class GetPeopleRequest extends RequestBase {

    // if nodeId is non-null we return only the info for the users associated with that node, whichi 
    // means everyone mentioned in the text plus, everyone in the shares.
	private String nodeId;

    public String getNodeId() {
        return nodeId;
    }

    public void setNodeId(String nodeId) {
        this.nodeId = nodeId;
    }
}
