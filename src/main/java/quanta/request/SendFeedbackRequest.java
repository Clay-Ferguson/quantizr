
package quanta.request;

import quanta.request.base.RequestBase;

public class SendFeedbackRequest extends RequestBase {
	private String message;

	public SendFeedbackRequest() {}

	public String getMessage() {
		return message;
	}

	public void setMessage(String message) {
		this.message = message;
	}
}
