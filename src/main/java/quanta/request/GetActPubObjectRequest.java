package quanta.request;

import quanta.request.base.RequestBase;

public class GetActPubObjectRequest extends RequestBase {
	private String url;

	public String getUrl() {
		return url;
	}

	public void setUrl(String url) {
		this.url = url;
	}
}
