
package quanta.request;

import quanta.request.base.RequestBase;

public class UploadFromUrlRequest extends RequestBase {
	/* if this is false we store only a link to the file, rather than copying it into our db */
	private boolean storeLocally;
	private String nodeId;
	private String sourceUrl;
	private String openAiPrompt;
	private boolean highDef;
	private String size;

	public UploadFromUrlRequest() {}

	public boolean isStoreLocally() {
		return this.storeLocally;
	}

	public String getNodeId() {
		return this.nodeId;
	}

	public String getSourceUrl() {
		return this.sourceUrl;
	}

	public void setStoreLocally(final boolean storeLocally) {
		this.storeLocally = storeLocally;
	}

	public void setNodeId(final String nodeId) {
		this.nodeId = nodeId;
	}

	public void setSourceUrl(final String sourceUrl) {
		this.sourceUrl = sourceUrl;
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
