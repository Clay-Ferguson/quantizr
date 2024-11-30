
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class ModifySubGraphRequest extends RequestBase {
	private String targetSet; // "recursive" or "children"
	private String nodeId;
	private String hashtags;
	private String action;

	public String getNodeId() {
		return this.nodeId;
	}

	public void setNodeId(final String nodeId) {
		this.nodeId = nodeId;
	}

	public String getHashtags() {
		return this.hashtags;
	}

	public void setHashtags(final String hashtags) {
		this.hashtags = hashtags;
	}

	public String getAction() {
		return this.action;
	}

	public void setAction(final String action) {
		this.action = action;
	}

	public String getTargetSet() {
		return this.targetSet;
	}

	public void setTargetSet(final String targetSet) {
		this.targetSet = targetSet;
	}

	public ModifySubGraphRequest() {}
}
