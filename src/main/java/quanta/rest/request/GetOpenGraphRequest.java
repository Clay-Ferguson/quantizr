
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class GetOpenGraphRequest extends RequestBase {
	private String url;
	
	public String getUrl() {
		return this.url;
	}
	
	public void setUrl(final String url) {
		this.url = url;
	}

	public GetOpenGraphRequest() {
	}
}
