
package quanta.rest.request;

import java.util.List;
import quanta.rest.request.base.RequestBase;

public class DeleteNodesRequest extends RequestBase {
	private List<String> nodeIds;
	private boolean childrenOnly;
	private boolean bulkDelete;

	/*
	 * This is used to jump to the parent of the node being deleted. We do this whenever we're deleting
	 * the node that's the root of what the user is now viewing. This is the nodeId of this root, whose
	 * parent we want to go to after the deletion
	 */
	private String jumpToParentOf;

	/*
	 * If force is true it means don't do the 'preDeleteCheck' (we won't care of we're deleting other
	 * peoples nodes) that may exist in the subgraphs of deleted nodes. If 'force' is false that means
	 * we will do the preDelteCheck and if we find things to warn the user about we send back that
	 * warning rather than doing the actual delete.
	 */
	private boolean force;

	public List<String> getNodeIds() {
		return this.nodeIds;
	}

	public boolean isChildrenOnly() {
		return this.childrenOnly;
	}

	public boolean isBulkDelete() {
		return this.bulkDelete;
	}

	public void setNodeIds(final List<String> nodeIds) {
		this.nodeIds = nodeIds;
	}

	public void setChildrenOnly(final boolean childrenOnly) {
		this.childrenOnly = childrenOnly;
	}

	public void setBulkDelete(final boolean bulkDelete) {
		this.bulkDelete = bulkDelete;
	}

	public String getJumpToParentOf() {
		return jumpToParentOf;
	}

	public void setJumpToParentOf(String jumpToParentOf) {
		this.jumpToParentOf = jumpToParentOf;
	}

	public boolean isForce() {
		return force;
	}

	public void setForce(boolean force) {
		this.force = force;
	}

	public DeleteNodesRequest() {}
}
