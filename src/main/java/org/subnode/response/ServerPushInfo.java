package org.subnode.response;

public class ServerPushInfo {

	/**
	 * Examples: type=='newNode' nodeId=[id of the node]
	 */
	private String type;
	private String nodeId;

	//WARNING: parameterless constructor required for marshalling.
	public ServerPushInfo() {
	}

	public ServerPushInfo(String type, String nodeId) {
		this.type = type;
		this.nodeId = nodeId;
	}

	public String getType() {
		return type;
	}

	public void setType(String type) {
		this.type = type;
	}

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}
}
