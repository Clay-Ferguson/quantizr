package org.subnode.response;

import java.util.List;
import org.subnode.response.base.ResponseBase;

public class GetServerInfoResponse extends ResponseBase {

	private List<InfoMessage> messages;

	public List<InfoMessage> getMessages() {
		return messages;
	}

	public void setMessages(List<InfoMessage> messages) {
		this.messages = messages;
	}
}
