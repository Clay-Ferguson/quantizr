package org.subnode.request;

import java.util.List;
import org.subnode.request.base.RequestBase;

public class DeletePropertyRequest extends RequestBase {
	private String nodeId;
	private List<String> propNames;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public List<String> getPropNames() {
		return propNames;
	}

	public void setPropNames(List<String> propNames) {
		this.propNames = propNames;
	}
}
