package org.subnode.request;

import org.subnode.request.base.RequestBase;

/* Request for inserting new node under the parentId, just below the targetId. TargetId can be null and the new node will just be appended
 * to the end of the child list, or may even be the first (i.e. only) child.
 */
public class InsertNodeRequest extends RequestBase {
	//todo-0: need to rename this to 'publish', and not let it set the mod time at all, and this will trigger any paths
	//starting in /r/p/ (pending) to go public at their same '/r/' path with the 'p' part removed. Remember whenever you do this
	//and get rid of the 'mod time' based indicator you'll need to update removeAbandonedNodes so that it cleans out all
	// '/r/p/' nodes instead of doing what it does currently based on timestamp.
	private boolean updateModTime;
	
	private String parentId;
	private Long targetOrdinal;
	private String newNodeName;
	private String typeName;
	private String initialValue;

	public String getParentId() {
		return parentId;
	}

	public void setParentId(String parentId) {
		this.parentId = parentId;
	}

	public String getNewNodeName() {
		return newNodeName;
	}

	public void setNewNodeName(String newNodeName) {
		this.newNodeName = newNodeName;
	}

	public String getTypeName() {
		return typeName;
	}

	public void setTypeName(String typeName) {
		this.typeName = typeName;
	}

	public Long getTargetOrdinal() {
		return targetOrdinal;
	}

	public void setTargetOrdinal(Long targetOrdinal) {
		this.targetOrdinal = targetOrdinal;
	}

	public String getInitialValue() {
		return initialValue;
	}

	public void setInitialValue(String initialValue) {
		this.initialValue = initialValue;
	}

	public boolean isUpdateModTime() {
		return updateModTime;
	}

	public void setUpdateModTime(boolean updateModTime) {
		this.updateModTime = updateModTime;
	}
}
