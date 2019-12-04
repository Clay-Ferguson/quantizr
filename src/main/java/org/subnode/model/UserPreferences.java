package org.subnode.model;

/**
 * Models UserPreferences
 */
public class UserPreferences {
	private boolean editMode;
	private boolean showMetaData;
	private boolean showPath;
	private boolean advancedMode;
	private boolean importAllowed;
	private boolean exportAllowed;

	public boolean isAdvancedMode() {
		return advancedMode;
	}

	public void setAdvancedMode(boolean advancedMode) {
		this.advancedMode = advancedMode;
	}

	public boolean isEditMode() {
		return editMode;
	}

	public void setEditMode(boolean editMode) {
		this.editMode = editMode;
	}

	public boolean isImportAllowed() {
		return importAllowed;
	}

	public void setImportAllowed(boolean importAllowed) {
		this.importAllowed = importAllowed;
	}

	public boolean isExportAllowed() {
		return exportAllowed;
	}

	public void setExportAllowed(boolean exportAllowed) {
		this.exportAllowed = exportAllowed;
	}

	public boolean isShowMetaData() {
		return showMetaData;
	}

	public void setShowMetaData(boolean showMetaData) {
		this.showMetaData = showMetaData;
	}

	public boolean isShowPath() {
		return showPath;
	}

	public void setShowPath(boolean showPath) {
		this.showPath = showPath;
	}
}
