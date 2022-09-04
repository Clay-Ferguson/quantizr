package quanta.request;

import quanta.request.base.RequestBase;

public class ExportRequest extends RequestBase {
	private String nodeId;

	// must be file extension, and selects which type of file to export
	private String exportExt;

	private String fileName;

	private boolean toIpfs;

	private boolean includeToc;

	public String getNodeId() {
		return nodeId;
	}

	public String getFileName() {
		return fileName;
	}

	public void setFileName(String fileName) {
		this.fileName = fileName;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getExportExt() {
		return exportExt;
	}

	public void setExportExt(String exportExt) {
		this.exportExt = exportExt;
	}

	public boolean isToIpfs() {
		return toIpfs;
	}

	public void setToIpfs(boolean toIpfs) {
		this.toIpfs = toIpfs;
	}

	public boolean isIncludeToc() {
		return includeToc;
	}

	public void setIncludeToc(boolean includeToc) {
		this.includeToc = includeToc;
	}
}
