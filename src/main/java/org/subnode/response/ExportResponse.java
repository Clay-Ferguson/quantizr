package org.subnode.response;

import org.subnode.response.base.ResponseBase;

public class ExportResponse extends ResponseBase {

	private String ipfsCid;
	private String ipfsMime;
	
	private String fileName;

	public String getFileName() {
		return fileName;
	}

	public void setFileName(String fileName) {
		this.fileName = fileName;
	}

	public String getIpfsCid() {
		return ipfsCid;
	}

	public void setIpfsCid(String ipfsCid) {
		this.ipfsCid = ipfsCid;
	}

	public String getIpfsMime() {
		return ipfsMime;
	}

	public void setIpfsMime(String ipfsMime) {
		this.ipfsMime = ipfsMime;
	}
}
