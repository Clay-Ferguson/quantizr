package quanta.response;

public class PushPageMessage extends ServerPushInfo {

	private String payload;

	public String getPayload() {
		return payload;
	}

	public void setPayload(String payload) {
		this.payload = payload;
	}

	//WARNING: parameterless constructor required for marshalling.
	public PushPageMessage() {
	}

	public PushPageMessage(String payload) {
		super("pushPageMessage");
		this.payload = payload;
	}
}
