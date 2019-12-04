package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class UploadFromUrlRequest extends RequestBase {

	private String nodeId;
	private String sourceUrl;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getSourceUrl() {
		return sourceUrl;
	}

	public void setSourceUrl(String sourceUrl) {
		this.sourceUrl = sourceUrl;
	}
}
