
package quanta.rest.request;

import java.util.List;
import quanta.rest.request.base.RequestBase;

public class PasteAttachmentsRequest extends RequestBase {
	private String sourceNodeId;
	private String targetNodeId;
	private List<String> keys;

	public String getSourceNodeId() {
		return sourceNodeId;
	}

	public void setSourceNodeId(String sourceNodeId) {
		this.sourceNodeId = sourceNodeId;
	}

	public String getTargetNodeId() {
		return targetNodeId;
	}

	public void setTargetNodeId(String targetNodeId) {
		this.targetNodeId = targetNodeId;
	}

	public List<String> getKeys() {
		return keys;
	}

	public void setKeys(List<String> keys) {
		this.keys = keys;
	}
}
