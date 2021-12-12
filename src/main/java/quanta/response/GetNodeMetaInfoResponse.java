package quanta.response;


import java.util.List;
import quanta.model.client.NodeMetaIntf;
import quanta.response.base.ResponseBase;

public class GetNodeMetaInfoResponse extends ResponseBase {
	public List<NodeMetaIntf> nodeIntf;

	public List<NodeMetaIntf> getNodeIntf() {
		return nodeIntf;
	}

	public void setNodeIntf(List<NodeMetaIntf> nodeIntf) {
		this.nodeIntf = nodeIntf;
	}
}
