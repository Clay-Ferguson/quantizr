package org.subnode.response;


import java.util.List;
import org.subnode.model.client.NodeMetaIntf;
import org.subnode.response.base.ResponseBase;

public class GetNodeMetaInfoResponse extends ResponseBase {
	public List<NodeMetaIntf> nodeIntf;

	public List<NodeMetaIntf> getNodeIntf() {
		return nodeIntf;
	}

	public void setNodeIntf(List<NodeMetaIntf> nodeIntf) {
		this.nodeIntf = nodeIntf;
	}
}
