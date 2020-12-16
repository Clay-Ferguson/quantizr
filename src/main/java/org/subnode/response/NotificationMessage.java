package org.subnode.response;

public class NotificationMessage extends ServerPushInfo {

	private String nodeId;

	private String fromUser;
	private String message;

	//WARNING: parameterless constructor required for marshalling.
	public NotificationMessage() {
	}

	public NotificationMessage(String type, String nodeId, String message, String fromUser) {
		super(type);
		this.nodeId = nodeId;
		this.message = message;
		this.fromUser = fromUser;
	}

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getMessage() {
		return message;
	}

	public void setMessage(String message) {
		this.message = message;
	}

	public String getFromUser() {
		return fromUser;
	}

	public void setFromUser(String fromUser) {
		this.fromUser = fromUser;
	}
}
