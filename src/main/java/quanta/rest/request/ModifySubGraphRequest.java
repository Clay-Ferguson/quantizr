
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class ModifySubGraphRequest extends RequestBase {
	private boolean recursive;
	private String nodeId;
	private String hashtags;
	private String action;

	public boolean isRecursive() {
		return this.recursive;
	}

	public String getNodeId() {
		return this.nodeId;
	}

	public void setRecursive(final boolean recursive) {
		this.recursive = recursive;
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

	public ModifySubGraphRequest() {}
}
