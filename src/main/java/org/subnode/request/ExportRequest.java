package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class ExportRequest extends RequestBase {
	private String nodeId;

	// must be file extension, and selects which type of file to export
	private String exportExt;

	private String fileName;

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
}
