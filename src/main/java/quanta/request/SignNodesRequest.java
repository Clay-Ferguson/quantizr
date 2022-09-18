package quanta.request;

import java.util.List;
import quanta.request.base.RequestBase;
import quanta.response.NodeSigData;

/* In this reply all the 'data' in each NodeSigData is the signature, and not the data to be signed */
public class SignNodesRequest extends RequestBase {
    private Integer workloadId;
	private List<NodeSigData> listToSign;

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
