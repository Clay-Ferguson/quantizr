
package quanta.request;

import quanta.request.base.RequestBase;

public class GenerateBookByAIRequest extends RequestBase {
	private String nodeId;
	private String prompt;
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
}
