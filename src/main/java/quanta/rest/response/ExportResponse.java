
package quanta.rest.response;

import quanta.rest.response.base.ResponseBase;

public class ExportResponse extends ResponseBase {
	private String fileName;

	public String getFileName() {
		return this.fileName;
	}

	public void setFileName(final String fileName) {
		this.fileName = fileName;
	}

	public ExportResponse() {}
}
