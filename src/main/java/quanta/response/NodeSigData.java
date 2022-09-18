package quanta.response;

/* Holds NodeId and data to be signed by the browser for the node */
public class NodeSigData {

	private String nodeId;
	private String data;

	public NodeSigData() {}

	public NodeSigData(String nodeId, String data) {
		this.nodeId = nodeId;
		this.data = data;
	}

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public String getData() {
		return data;
	}

	public void setData(String data) {
		this.data = data;
	}
}
