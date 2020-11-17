package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class LoadNodeFromIpfsRequest extends RequestBase {

	private String path;

	public String getPath() {
		return path;
	}

	public void setPath(String path) {
		this.path = path;
	}
}
