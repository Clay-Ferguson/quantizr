package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class InsertBookRequest extends RequestBase {
	private String nodeId;
	private String bookName;

	/* set to true to only insert a portion of the entire book */
	private Boolean truncated;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getBookName() {
		return bookName;
	}

	public void setBookName(String bookName) {
		this.bookName = bookName;
	}

	public Boolean getTruncated() {
		return truncated;
	}

	public void setTruncated(Boolean truncated) {
		this.truncated = truncated;
	}
}
