package org.subnode.response;

import org.subnode.response.base.ResponseBase;

public class ExportResponse extends ResponseBase {

	private String fileName;

	public String getFileName() {
		return fileName;
	}

	public void setFileName(String fileName) {
		this.fileName = fileName;
	}
}
