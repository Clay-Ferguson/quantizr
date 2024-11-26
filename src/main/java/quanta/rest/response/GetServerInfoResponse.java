
package quanta.rest.response;

import java.util.List;
import quanta.rest.response.base.ResponseBase;

public class GetServerInfoResponse extends ResponseBase {
	private List<InfoMessage> messages;
	private String format; // txt, html, or md

	public List<InfoMessage> getMessages() {
		return this.messages;
	}

	public void setMessages(final List<InfoMessage> messages) {
		this.messages = messages;
	}

	public String getFormat() {
		return format;
	}

	public void setFormat(String format) {
		this.format = format;
	}

	public GetServerInfoResponse() {}
}
