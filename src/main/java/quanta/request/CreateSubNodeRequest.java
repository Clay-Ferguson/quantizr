package quanta.request;

import java.util.List;
import javax.annotation.Nullable;
import quanta.model.PropertyInfo;
import quanta.request.base.RequestBase;

public class CreateSubNodeRequest extends RequestBase {

	private String nodeId;
	private String boostTarget;

	private boolean pendingEdit;
	private String content; // optional, default content

	private String newNodeName;
	private String typeName;
	private boolean createAtTop;

	/* Adds TYPE_LOCK property which prevents user from being able to change the type on the node */
	private boolean typeLock;

	// default properties to add, or null if none
	private List<PropertyInfo> properties;

	// for a DM this can be optionally provided to share the node with this person immediately
	private String shareToUserId;

	// If this node is a reply to a boosted node, then we will recieve the booster id here so the node can
	// also be shared with that person as well.
	private String boosterUserId;

	// send out over Fediverse only if this is true. Will generally be either something created by a
	// "Post" button or a "Reply" button only
	private boolean fediSend;

	public String getShareToUserId() {
		return shareToUserId;
	}

	public void setShareToUserId(String shareToUserId) {
		this.shareToUserId = shareToUserId;
	}

	public String getBoosterUserId() {
		return boosterUserId;
	}

	public void setBoosterUserId(String boosterUserId) {
		this.boosterUserId = boosterUserId;
	}

	/* special purpose values for when creating special types of nodes */
	@Nullable
	private String payloadType;

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

	public boolean isTypeLock() {
		return typeLock;
	}

	public void setTypeLock(boolean typeLock) {
		this.typeLock = typeLock;
	}

	public List<PropertyInfo> getProperties() {
		return properties;
	}

	public void setProperties(List<PropertyInfo> properties) {
		this.properties = properties;
	}

	public boolean isPendingEdit() {
		return pendingEdit;
	}

	public void setPendingEdit(boolean pendingEdit) {
		this.pendingEdit = pendingEdit;
	}

	public String getPayloadType() {
		return payloadType;
	}

	public void setPayloadType(String payloadType) {
		this.payloadType = payloadType;
	}

	public String getBoostTarget() {
		return boostTarget;
	}

	public void setBoostTarget(String boostTarget) {
		this.boostTarget = boostTarget;
	}

	public boolean isFediSend() {
		return fediSend;
	}

	public void setFediSend(boolean fediSend) {
		this.fediSend = fediSend;
	}
}
