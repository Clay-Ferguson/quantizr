package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class GenerateNodeHashRequest extends RequestBase {
	private String nodeId;

	/* If this is true we ONLY do a verify, and do not actually write out any merkle properties */
	private boolean verify;

	public boolean isVerify() {
		return verify;
	}

	public void setVerify(boolean verify) {
		this.verify = verify;
	}

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}
}
