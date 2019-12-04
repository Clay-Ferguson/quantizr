package org.subnode.response;

import org.subnode.response.base.ResponseBase;

public class GenerateNodeHashResponse extends ResponseBase {
	private String hashInfo;

	public String getHashInfo() {
		return hashInfo;
	}

	public void setHashInfo(String hashInfo) {
		this.hashInfo = hashInfo;
	}
}
