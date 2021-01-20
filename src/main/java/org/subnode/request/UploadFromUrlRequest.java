package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class UploadFromUrlRequest extends RequestBase {

	/* if this is false we store only a link to the file, rather than copying it into our db */
	private boolean storeLocally;
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

	public boolean isStoreLocally() {
		return storeLocally;
	}

	public void setStoreLocally(boolean storeLocally) {
		this.storeLocally = storeLocally;
	}
}
