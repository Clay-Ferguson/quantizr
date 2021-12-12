package quanta.response;

public class SessionTimeoutPushInfo extends ServerPushInfo {

	// WARNING: parameterless constructor required for marshalling.
	public SessionTimeoutPushInfo() {
		setType("sessionTimeout");
	}
}
