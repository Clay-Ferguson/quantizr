package org.subnode.model;

/**
 * Models a Referenceable node.
 */
public class RefInfo {
	private String id;
	private String path;

	public RefInfo(String id, String path) {
		this.id = id;
		this.path = path;
	}

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}

	public String getPath() {
		return path;
	}

	public void setPath(String path) {
		this.path = path;
	}
}
