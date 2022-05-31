package quanta.response;

public class PushPageMessage extends ServerPushInfo {

	private String payload;
	private boolean usePopup;

	public String getPayload() {
		return payload;
	}

	public void setPayload(String payload) {
		this.payload = payload;
	}

	//WARNING: parameterless constructor required for marshalling.
	public PushPageMessage() {
	}

	public PushPageMessage(String payload, boolean usePopup) {
		super("pushPageMessage");
		this.payload = payload;
		this.usePopup = usePopup;
	}

	public boolean isUsePopup() {
		return usePopup;
	}

	public void setUsePopup(boolean usePopup) {
		this.usePopup = usePopup;
	}
}
