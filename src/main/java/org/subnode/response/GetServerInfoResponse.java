package org.subnode.response;

import org.subnode.response.base.ResponseBase;

public class GetServerInfoResponse extends ResponseBase {
	private String serverInfo;

	//Types: note==null | inbox
	private String infoType; 

	public String getServerInfo() {
		return serverInfo;
	}

	public void setServerInfo(String serverInfo) {
		this.serverInfo = serverInfo;
	}

	public String getInfoType() {
		return infoType;
	}

	public void setInfoType(String infoType) {
		this.infoType = infoType;
	}
}
