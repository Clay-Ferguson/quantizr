package org.subnode.request;


import java.util.List;

import org.subnode.model.PropertyInfo;
import org.subnode.request.base.RequestBase;

public class SaveNodeRequest extends RequestBase {
	private String nodeId;

	/*
	 * properties to save. Not necessarily the complete list of properties on this node, but just
	 * the ones we will persist
	 */
	private List<PropertyInfo> properties;

	private String content; 
	private String name;

	private boolean sendNotification;

	public String getNodeId() {
		return nodeId;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getContent() {
		return content;
	}

	public void setContent(String content) {
		this.content = content;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public List<PropertyInfo> getProperties() {
		return properties;
	}

	public void setProperties(List<PropertyInfo> properties) {
		this.properties = properties;
	}

	public boolean isSendNotification() {
		return sendNotification;
	}

	public void setSendNotification(boolean sendNotification) {
		this.sendNotification = sendNotification;
	}
}
