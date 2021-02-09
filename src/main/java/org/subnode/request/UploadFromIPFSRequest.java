package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class UploadFromIPFSRequest extends RequestBase {

	/* if this is false we store only a link to the file, rather than copying it into our db */
	private boolean pinLocally;
	private String nodeId;
	private String cid;
	private String mime;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getCid() {
		return cid;
	}

	public void setCid(String cid) {
		this.cid = cid;
	}

	public boolean isPinLocally() {
		return pinLocally;
	}

	public void setPinLocally(boolean pinLocally) {
		this.pinLocally = pinLocally;
	}

	public String getMime() {
		return mime;
	}

	public void setMime(String mime) {
		this.mime = mime;
	}
}
