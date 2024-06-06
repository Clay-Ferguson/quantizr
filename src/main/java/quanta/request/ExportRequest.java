
package quanta.request;

import quanta.request.base.RequestBase;

public class ExportRequest extends RequestBase {
	private String nodeId;
	// must be file extension, and selects which type of file to export
	private String exportExt;
	private String fileName;
	private boolean includeToc;
	private boolean includeMetaComments;
	private boolean attOneFolder;
	private String contentType;
	private boolean includeJypyter;
	private boolean includeIDs;
	private boolean dividerLine;
	private boolean updateHeadings;

	public ExportRequest() {}

	public String getNodeId() {
		return this.nodeId;
	}

	public String getExportExt() {
		return this.exportExt;
	}

	public String getFileName() {
		return this.fileName;
	}

	public boolean isIncludeToc() {
		return this.includeToc;
	}

	public boolean isIncludeMetaComments() {
		return includeMetaComments;
	}

	public void setIncludeMetaComments(boolean includeMetaComments) {
		this.includeMetaComments = includeMetaComments;
	}

	// todo-0: remove this flag. It's just too much complexity in the code. We never need all attachments crammed in a single folder
	//         so this was always just a bad idea
	public boolean isAttOneFolder() {
		return this.attOneFolder;
	}

	public boolean isIncludeJypyter() {
		return this.includeJypyter;
	}

	public boolean isIncludeIDs() {
		return this.includeIDs;
	}

	public boolean isDividerLine() {
		return this.dividerLine;
	}

	public boolean isUpdateHeadings() {
		return this.updateHeadings;
	}

	public void setNodeId(final String nodeId) {
		this.nodeId = nodeId;
	}

	public void setExportExt(final String exportExt) {
		this.exportExt = exportExt;
	}

	public void setFileName(final String fileName) {
		this.fileName = fileName;
	}

	public void setIncludeToc(final boolean includeToc) {
		this.includeToc = includeToc;
	}

	public void setAttOneFolder(final boolean attOneFolder) {
		this.attOneFolder = attOneFolder;
	}

	public void setIncludeJypyter(final boolean includeJypyter) {
		this.includeJypyter = includeJypyter;
	}

	public void setIncludeIDs(final boolean includeIDs) {
		this.includeIDs = includeIDs;
	}

	public void setDividerLine(final boolean dividerLine) {
		this.dividerLine = dividerLine;
	}

	public void setUpdateHeadings(final boolean updateHeadings) {
		this.updateHeadings = updateHeadings;
	}

	public String getContentType() {
		return contentType;
	}

	public void setContentType(String contentType) {
		this.contentType = contentType;
	}
}
