package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class CreateSubNodeRequest extends RequestBase {
	
	private String nodeId;

	//todo-1: is there a JSON annotaiton to make this optional on TS object
	private String content; //optional, default content
	
	private String newNodeName;
	private String typeName;
	private boolean createAtTop;

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
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

	public String getContent() {
		return content;
	}

	public void setContent(String content) {
		this.content = content;
	}

	public boolean isCreateAtTop() {
		return createAtTop;
	}

	public void setCreateAtTop(boolean createAtTop) {
		this.createAtTop = createAtTop;
	}
}
