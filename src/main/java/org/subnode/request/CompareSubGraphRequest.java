package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class CompareSubGraphRequest extends RequestBase {
	private String nodeIdA;
	private String nodeIdB;

	public String getNodeIdA() {
		return nodeIdA;
	}

	public void setNodeIdA(String nodeIdA) {
		this.nodeIdA = nodeIdA;
	}

	public String getNodeIdB() {
		return nodeIdB;
	}

	public void setNodeIdB(String nodeIdB) {
		this.nodeIdB = nodeIdB;
	}
}
