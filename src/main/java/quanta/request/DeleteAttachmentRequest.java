package quanta.request;

import quanta.request.base.RequestBase;

public class DeleteAttachmentRequest extends RequestBase {
	private String nodeId;

	// comma delimited list of names of attachments to delete (the map keys)
	private String attName;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getAttName() {
		return attName;
	}

	public void setAttName(String attName) {
		this.attName = attName;
	}
}
