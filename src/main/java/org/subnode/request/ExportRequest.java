package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class ExportRequest extends RequestBase {
	private String nodeId;

	// must be file extension, and selects which type of file to export
	private String exportExt;

	public String getNodeId() {
		return nodeId;
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
