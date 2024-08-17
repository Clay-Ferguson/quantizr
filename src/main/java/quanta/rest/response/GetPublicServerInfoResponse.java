
package quanta.rest.response;

import quanta.rest.response.base.ResponseBase;

public class GetPublicServerInfoResponse extends ResponseBase {
	private String serverInfo;

	public String getServerInfo() {
		return this.serverInfo;
	}
	
	public void setServerInfo(final String serverInfo) {
		this.serverInfo = serverInfo;
	}

	public GetPublicServerInfoResponse() {
	}
}
