package org.subnode.response;

import org.subnode.model.NodeInfo;

public class NodeEditedPushInfo extends ServerPushInfo {

	private NodeInfo nodeInfo;

	//WARNING: parameterless constructor required for marshalling.
	public NodeEditedPushInfo() {
	}

	public NodeEditedPushInfo(NodeInfo nodeInfo) {
		super("nodeEdited");
		this.nodeInfo = nodeInfo;
	}

	public NodeInfo getNodeInfo() {
		return nodeInfo;
	}

	public void setNodeInfo(NodeInfo nodeInfo) {
		this.nodeInfo = nodeInfo;
	}
}
