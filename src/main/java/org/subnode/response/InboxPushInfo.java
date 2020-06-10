package org.subnode.response;

public class InboxPushInfo extends ServerPushInfo {

	private String nodeId;

	//WARNING: parameterless constructor required for marshalling.
	public InboxPushInfo() {
	}

	public InboxPushInfo(String nodeId) {
		super("inboxPush");
		this.nodeId = nodeId;
	}

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}
}
