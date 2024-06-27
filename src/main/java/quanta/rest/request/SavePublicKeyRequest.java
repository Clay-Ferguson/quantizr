
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class SavePublicKeyRequest extends RequestBase {
	private String asymEncKey;
	private String sigKey;

	public String getAsymEncKey() {
		return this.asymEncKey;
	}

	public String getSigKey() {
		return this.sigKey;
	}

	public void setAsymEncKey(final String asymEncKey) {
		this.asymEncKey = asymEncKey;
	}

	public void setSigKey(final String sigKey) {
		this.sigKey = sigKey;
	}

	public SavePublicKeyRequest() {}
}
