package quanta.request;

import quanta.request.base.RequestBase;

public class UploadFromTorrentRequest extends RequestBase {
	private String nodeId;
	private String torrentId;

	public String getTorrentId() {
		return torrentId;
	}

	public void setTorrentId(String torrentId) {
		this.torrentId = torrentId;
	}

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}
}
