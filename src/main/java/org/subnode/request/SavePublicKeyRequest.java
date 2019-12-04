package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class SavePublicKeyRequest extends RequestBase {
	private String keyJson;

	public String getKeyJson() {
		return keyJson;
	}

	public void setKeyJson(String keyJson) {
		this.keyJson = keyJson;
	}
}
