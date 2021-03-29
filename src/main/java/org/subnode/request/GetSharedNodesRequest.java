package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class GetSharedNodesRequest extends RequestBase {

	/* can be node id or path. server interprets correctly no matter which */
	private String nodeId;

	/* can be 'public' to find keys in ACL or else null to find all non-null acls */
	private String shareTarget;

	private String accessOption; //for public can be rd, rw, or null (all)

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getShareTarget() {
		return shareTarget;
	}

	public void setShareTarget(String shareTarget) {
		this.shareTarget = shareTarget;
	}

	public String getAccessOption() {
		return accessOption;
	}

	public void setAccessOption(String accessOption) {
		this.accessOption = accessOption;
	}
}
