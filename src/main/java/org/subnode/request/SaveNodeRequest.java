package org.subnode.request;

import org.subnode.model.NodeInfo;
import org.subnode.request.base.RequestBase;

public class SaveNodeRequest extends RequestBase {

	boolean updateModTime;
	private NodeInfo node;

	public NodeInfo getNode() {
		return node;
	}

	public void setNode(NodeInfo node) {
		this.node = node;
	}

	public boolean isUpdateModTime() {
		return updateModTime;
	}

	public void setUpdateModTime(boolean updateModTime) {
		this.updateModTime = updateModTime;
	}
}
