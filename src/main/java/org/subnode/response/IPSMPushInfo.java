package org.subnode.response;

public class IPSMPushInfo extends ServerPushInfo {

	private String payload;

	public String getPayload() {
		return payload;
	}

	public void setPayload(String payload) {
		this.payload = payload;
	}

	//WARNING: parameterless constructor required for marshalling.
	public IPSMPushInfo() {
	}

	public IPSMPushInfo(String payload) {
		super("ipsmPush");
		this.payload = payload;
	}
}
