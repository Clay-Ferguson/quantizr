package org.subnode.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Models UserPreferences
 */
public class UserPreferences {
	private boolean editMode;
	private boolean showMetaData;
	private boolean rssHeadlinesOnly;

	public boolean isRssHeadlinesOnly() {
		return rssHeadlinesOnly;
	}

	public void setRssHeadlinesOnly(boolean rssHeadlinesOnly) {
		this.rssHeadlinesOnly = rssHeadlinesOnly;
	}

	@JsonProperty(required = false)
	private long maxUploadFileSize;

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
