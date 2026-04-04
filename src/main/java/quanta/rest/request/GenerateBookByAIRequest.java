
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class GenerateBookByAIRequest extends RequestBase {
	private String nodeId;
	private String prompt;
	private Integer numChapters;
	private Integer numSections;

	public GenerateBookByAIRequest() {}

	public String getPrompt() {
		return prompt;
	}

	public void setPrompt(String prompt) {
		this.prompt = prompt;
	}

	public String getNodeId() {
		return this.nodeId;
	}

	public void setNodeId(final String nodeId) {
		this.nodeId = nodeId;
	}

	public Integer getNumChapters() {
		return numChapters;
	}

	public void setNumChapters(Integer numChapters) {
		this.numChapters = numChapters;
	}

	public Integer getNumSections() {
		return numSections;
	}

	public void setNumSections(Integer numSections) {
		this.numSections = numSections;
	}
}
