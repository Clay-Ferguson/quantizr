package quanta.request;

import quanta.request.base.RequestBase;

public class SetCipherKeyRequest extends RequestBase {

	private String nodeId;
	private String principalNodeId;
	private String cipherKey;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getPrincipalNodeId() {
		return principalNodeId;
	}

	public void setPrincipalNodeId(String principalNodeId) {
		this.principalNodeId = principalNodeId;
	}

	public String getCipherKey() {
		return cipherKey;
	}

	public void setCipherKey(String cipherKey) {
		this.cipherKey = cipherKey;
	}
}
