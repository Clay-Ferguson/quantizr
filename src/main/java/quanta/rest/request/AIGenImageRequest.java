
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class AIGenImageRequest extends RequestBase {
	private String nodeId;
	private String openAiPrompt;
	private boolean highDef;
	private String size;

	public AIGenImageRequest() {}

	public String getNodeId() {
		return this.nodeId;
	}

	public void setNodeId(final String nodeId) {
		this.nodeId = nodeId;
	}

	public String getOpenAiPrompt() {
		return openAiPrompt;
	}

	public void setOpenAiPrompt(String openAiPrompt) {
		this.openAiPrompt = openAiPrompt;
	}

	public boolean isHighDef() {
		return highDef;
	}

	public void setHighDef(boolean highDef) {
		this.highDef = highDef;
	}

	public String getSize() {
		return size;
	}

	public void setSize(String size) {
		this.size = size;
	}
}
