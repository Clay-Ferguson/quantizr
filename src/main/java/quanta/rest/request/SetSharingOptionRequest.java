
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class SetSharingOptionRequest extends RequestBase {
	private String nodeId;
	private boolean unpublished;
	private boolean website;

	public String getNodeId() {
		return this.nodeId;
	}

	public boolean isUnpublished() {
		return this.unpublished;
	}

	public void setNodeId(final String nodeId) {
		this.nodeId = nodeId;
	}

	public void setUnpublished(final boolean unpublished) {
		this.unpublished = unpublished;
	}

	public boolean isWebsite() {
		return website;
	}

	public void setWebsite(boolean website) {
		this.website = website;
	}

	public SetSharingOptionRequest() {}
}
