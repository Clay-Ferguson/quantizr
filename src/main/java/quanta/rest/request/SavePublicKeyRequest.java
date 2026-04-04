
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class SavePublicKeyRequest extends RequestBase {
	private String asymEncKey;

	public String getAsymEncKey() {
		return this.asymEncKey;
	}

	public void setAsymEncKey(final String asymEncKey) {
		this.asymEncKey = asymEncKey;
	}

	public SavePublicKeyRequest() {}
}
