package quanta.request;

import quanta.request.base.RequestBase;

public class OpenSystemFileRequest extends RequestBase {
	private String fileName;

	public String getFileName() {
		return fileName;
	}

	public void setFileName(String fileName) {
		this.fileName = fileName;
	}
}
