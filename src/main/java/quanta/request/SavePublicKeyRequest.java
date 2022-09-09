package quanta.request;

import quanta.request.base.RequestBase;

public class SavePublicKeyRequest extends RequestBase {
	private String asymEncKey;
	private String sigKey;

	public String getAsymEncKey() {
		return asymEncKey;
	}
	public void setAsymEncKey(String asymEncKey) {
		this.asymEncKey = asymEncKey;
	}
	public String getSigKey() {
		return sigKey;
	}
	public void setSigKey(String sigKey) {
		this.sigKey = sigKey;
	}
}
