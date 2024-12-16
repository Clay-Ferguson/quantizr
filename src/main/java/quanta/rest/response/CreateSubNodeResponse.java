
package quanta.rest.response;

import java.math.BigDecimal;
import quanta.model.NodeInfo;
import quanta.rest.response.base.NodeChanges;
import quanta.rest.response.base.ResponseBase;

public class CreateSubNodeResponse extends ResponseBase {
	private NodeInfo newNode;
	/*
	 * This is set to true in the response, when the parent node is encrypted and so we default the new
	 * child to be encrypted also.
	 * 
	 * Mainly used in a 'reply' to an encrypted node.
	 */
	private boolean encrypt;

	private NodeChanges nodeChanges;

	public NodeInfo getNewNode() {
		return this.newNode;
	}

	public boolean isEncrypt() {
		return this.encrypt;
	}

	public void setNewNode(final NodeInfo newNode) {
		this.newNode = newNode;
	}

	public void setEncrypt(final boolean encrypt) {
		this.encrypt = encrypt;
	}

	public NodeChanges getNodeChanges() {
		return nodeChanges;
	}

	public void setNodeChanges(NodeChanges nodeChanges) {
		this.nodeChanges = nodeChanges;
	}

	public CreateSubNodeResponse() {}
}
