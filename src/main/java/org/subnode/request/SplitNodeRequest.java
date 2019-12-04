package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class SplitNodeRequest extends RequestBase {

	//Nodes can be split right inline or by creating an array of child nodes.
	//INLINE or CHILDREN
	private String splitType;

	private String nodeId;
	private String delimiter;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getDelimiter() {
		return delimiter;
	}

	public void setDelimiter(String delimiter) {
		this.delimiter = delimiter;
	}

	public String getSplitType() {
		return splitType;
	}

	public void setSplitType(String splitType) {
		this.splitType = splitType;
	}
}
