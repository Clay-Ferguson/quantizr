package org.subnode.request;

import java.util.List;

import org.subnode.request.base.RequestBase;

public class DeleteNodesRequest extends RequestBase {
	private List<String> nodeIds;
	private boolean childrenOnly;

	public List<String> getNodeIds() {
		return nodeIds;
	}

	public void setNodeIds(List<String> nodeIds) {
		this.nodeIds = nodeIds;
	}

	public boolean isChildrenOnly() {
		return childrenOnly;
	}

	public void setChildrenOnly(boolean childrenOnly) {
		this.childrenOnly = childrenOnly;
	}
}
