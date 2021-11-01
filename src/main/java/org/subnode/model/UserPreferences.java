package org.subnode.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Models UserPreferences
 */
public class UserPreferences {
	private boolean editMode;
	private boolean showMetaData;
	private boolean rssHeadlinesOnly;

	// not persisted to DB yet. (todo-1)
	@JsonProperty(required = false)
	private boolean enableIPSM;

	@JsonProperty(required = false)
	private long maxUploadFileSize;

	public boolean isEnableIPSM() {
		return enableIPSM;
	}

	public void setEnableIPSM(boolean enableIPSM) {
		this.enableIPSM = enableIPSM;
	}

	public boolean isRssHeadlinesOnly() {
		return rssHeadlinesOnly;
	}

	public void setRssHeadlinesOnly(boolean rssHeadlinesOnly) {
		this.rssHeadlinesOnly = rssHeadlinesOnly;
	}

	public boolean isEditMode() {
		return editMode;
	}

	public void setEditMode(boolean editMode) {
		this.editMode = editMode;
	}
	
	public boolean isShowMetaData() {
		return showMetaData;
	}

	public void setShowMetaData(boolean showMetaData) {
		this.showMetaData = showMetaData;
	}

	@JsonProperty(required = false)
	public long getMaxUploadFileSize() {
		return maxUploadFileSize;
	}

	@JsonProperty(required = false)
	public void setMaxUploadFileSize(long maxUploadFileSize) {
		this.maxUploadFileSize = maxUploadFileSize;
	}
}
