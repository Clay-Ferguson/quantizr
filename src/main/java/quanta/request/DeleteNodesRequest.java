package quanta.request;

import java.util.List;

import quanta.request.base.RequestBase;

public class DeleteNodesRequest extends RequestBase {
	private List<String> nodeIds;
	private boolean childrenOnly;
	private boolean bulkDelete;

	public List<String> getNodeIds() {
		return nodeIds;
	}

	public void setNodeIds(List<String> nodeIds) {
		this.nodeIds = nodeIds;
	}

	public boolean isChildrenOnly() {
		return childrenOnly;
	}

	public void setChildrenOnly(boolean childrenOnly) {
		this.childrenOnly = childrenOnly;
	}

	public boolean isBulkDelete() {
		return bulkDelete;
	}

	public void setBulkDelete(boolean bulkDelete) {
		this.bulkDelete = bulkDelete;
	}
}
