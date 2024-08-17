
package quanta.rest.request;

import java.util.List;
import quanta.rest.request.base.RequestBase;

public class JoinNodesRequest extends RequestBase {
	private List<String> nodeIds;
	private boolean joinToParent;

	public boolean isJoinToParent() {
		return joinToParent;
	}

	public void setJoinToParent(boolean joinToParent) {
		this.joinToParent = joinToParent;
	}

	public List<String> getNodeIds() {
		return this.nodeIds;
	}

	public void setNodeIds(final List<String> nodeIds) {
		this.nodeIds = nodeIds;
	}

	public JoinNodesRequest() {}
}
