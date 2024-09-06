
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

/*
 * Request for inserting new node under the parentId, just below the targetId. TargetId can be null
 * and the new node will just be appended to the end of the child list, or may even be the first
 * (i.e. only) child.
 * 
 * Note: If client doesn't have 'parentId' then you can pass 'siblingId' instead and the assumed
 * parentId will be understood as the parent of the siblingId.
 */
public class InsertNodeRequest extends RequestBase {
	// this means the node is new and has not yet been "saved" by the user, and has a pending path on
	// it.
	private boolean pendingEdit;

	private String parentId;
	private String siblingId;
	private Long targetOrdinal;
	private String newNodeName;
	private String typeName;
	private String initialValue;
	private String aiMode;

	public boolean isPendingEdit() {
		return this.pendingEdit;
	}

	public String getParentId() {
		return this.parentId;
	}

	public String getSiblingId() {
		return siblingId;
	}

	public void setSiblingId(String siblingId) {
		this.siblingId = siblingId;
	}

	public Long getTargetOrdinal() {
		return this.targetOrdinal;
	}

	public String getNewNodeName() {
		return this.newNodeName;
	}

	public String getTypeName() {
		return this.typeName;
	}

	public String getInitialValue() {
		return this.initialValue;
	}

	public void setPendingEdit(final boolean pendingEdit) {
		this.pendingEdit = pendingEdit;
	}

	public void setParentId(final String parentId) {
		this.parentId = parentId;
	}

	public void setTargetOrdinal(final Long targetOrdinal) {
		this.targetOrdinal = targetOrdinal;
	}

	public void setNewNodeName(final String newNodeName) {
		this.newNodeName = newNodeName;
	}

	public void setTypeName(final String typeName) {
		this.typeName = typeName;
	}

	public void setInitialValue(final String initialValue) {
		this.initialValue = initialValue;
	}

	public String getAiMode() {
		return aiMode;
	}

	public void setAiMode(String aiMode) {
		this.aiMode = aiMode;
	}

	public InsertNodeRequest() {}
}
