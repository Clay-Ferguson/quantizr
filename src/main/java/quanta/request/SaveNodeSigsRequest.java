package quanta.request;

import java.util.List;
import quanta.model.NodeSig;
import quanta.request.base.RequestBase;

public class SaveNodeSigsRequest extends RequestBase {
	private List<NodeSig> sigs;

	public List<NodeSig> getSigs() {
		return sigs;
	}

	public void setSigs(List<NodeSig> sigs) {
		this.sigs = sigs;
	}
}
