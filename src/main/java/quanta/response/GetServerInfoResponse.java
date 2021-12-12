package quanta.response;

import java.util.List;
import quanta.response.base.ResponseBase;

public class GetServerInfoResponse extends ResponseBase {

	private List<InfoMessage> messages;

	public List<InfoMessage> getMessages() {
		return messages;
	}

	public void setMessages(List<InfoMessage> messages) {
		this.messages = messages;
	}
}
