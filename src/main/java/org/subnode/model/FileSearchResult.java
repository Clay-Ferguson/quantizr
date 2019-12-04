package org.subnode.model;

/**
 * Model representing a filename
 *
 */
public class FileSearchResult {
	private String fileName;

	public FileSearchResult() {
	}

	public FileSearchResult(String fileName) {
		this.fileName = fileName;
	}

	public String getFileName() {
		return fileName;
	}

	public void setFileName(String fileName) {
		this.fileName = fileName;
	}
}
