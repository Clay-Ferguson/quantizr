package quanta.request;

import quanta.request.base.RequestBase;

public class ExportRequest extends RequestBase {
	private String nodeId;

	// must be file extension, and selects which type of file to export
	private String exportExt;
	private String fileName;
	private boolean toIpfs;
	private boolean includeToc;
	private boolean largeHtmlFile;
	private boolean attOneFolder;

	private boolean includeJSON;
	private boolean includeMD;
	private boolean includeHTML;
	private boolean includeIDs;
	private boolean dividerLine;

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

	public boolean isLargeHtmlFile() {
		return largeHtmlFile;
	}

	public void setLargeHtmlFile(boolean largeHtmlFile) {
		this.largeHtmlFile = largeHtmlFile;
	}

	public boolean isAttOneFolder() {
		return attOneFolder;
	}

	public void setAttOneFolder(boolean attOneFolder) {
		this.attOneFolder = attOneFolder;
	}

	public boolean isIncludeJSON() {
		return includeJSON;
	}

	public void setIncludeJSON(boolean includeJSON) {
		this.includeJSON = includeJSON;
	}

	public boolean isIncludeMD() {
		return includeMD;
	}

	public void setIncludeMD(boolean includeMD) {
		this.includeMD = includeMD;
	}

	public boolean isIncludeHTML() {
		return includeHTML;
	}

	public void setIncludeHTML(boolean includeHTML) {
		this.includeHTML = includeHTML;
	}

	public boolean isIncludeIDs() {
		return includeIDs;
	}

	public void setIncludeIDs(boolean includeIDs) {
		this.includeIDs = includeIDs;
	}

	public boolean isDividerLine() {
		return dividerLine;
	}

	public void setDividerLine(boolean dividerLine) {
		this.dividerLine = dividerLine;
	}
}
