
package quanta.request;

import quanta.request.base.RequestBase;

public class AIGenSpeechRequest extends RequestBase {
	private String nodeId;
	private String openAiPrompt;
	private String voice;

	public AIGenSpeechRequest() {}

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

	public String getVoice() {
		return voice;
	}

	public void setVoice(String voice) {
		this.voice = voice;
	}
}
