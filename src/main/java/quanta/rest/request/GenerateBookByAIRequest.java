
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class GenerateBookByAIRequest extends RequestBase {
	private String nodeId;
	private String prompt;
	// todo-0: add also a field for numSections, and of course it will go into prompt as well
	private Integer numChapters;
	private String aiService;

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

	public String getAiService() {
		return aiService;
	}

	public void setAiService(String aiService) {
		this.aiService = aiService;
	}

	public Integer getNumChapters() {
		return numChapters;
	}

	public void setNumChapters(Integer numChapters) {
		this.numChapters = numChapters;
	}
}
