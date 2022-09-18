package quanta.response;

import java.util.List;

/* Holds a list of data to be pushed down to client for signing */
public class NodeSigPushInfo extends ServerPushInfo {

	private Integer workloadId;
	private List<NodeSigData> listToSign;

	public NodeSigPushInfo() {
		super("sigPush");
	}

	public NodeSigPushInfo(Integer workloadId) {
		this();
		this.workloadId = workloadId;
	}

	public Integer getWorkloadId() {
		return workloadId;
	}

	public void setWorkloadId(Integer workloadId) {
		this.workloadId = workloadId;
	}

	public List<NodeSigData> getListToSign() {
		return listToSign;
	}

	public void setListToSign(List<NodeSigData> listToSign) {
		this.listToSign = listToSign;
	}
}
