package quanta.rest.request;

import java.util.List;
import jakarta.annotation.Nullable;
import quanta.model.PropertyInfo;
import quanta.rest.request.base.RequestBase;

public class CreateSubNodeRequest extends RequestBase {

    private String nodeId;
    private boolean pendingEdit;
    private String content; // optional, default content
    private String newNodeName;
    private String typeName;
    private boolean createAtTop;
    private String aiMode;
    private boolean allowAiOverwrite;

    // If this is non-null it means we're asking a question on the parent, and the answer will come in
    // as a child. The string value determines the type of AI that will be asked to (OpenAI or
    // Perplexity, etc)
    private String aiService;

    /* Adds TYPE_LOCK property which prevents user from being able to change the type on the node */
    private boolean typeLock;

    // default properties to add, or null if none
    private List<PropertyInfo> properties;

    // for a DM this can be optionally provided to share the node with this person immediately
    private String shareToUserId;

    /* special purpose values for when creating special types of nodes */
    @Nullable
    private String payloadType;

    public String getNodeId() {
        return this.nodeId;
    }

    public boolean isPendingEdit() {
        return this.pendingEdit;
    }

    public String getContent() {
        return this.content;
    }

    public String getNewNodeName() {
        return this.newNodeName;
    }

    public String getTypeName() {
        return this.typeName;
    }

    public boolean isCreateAtTop() {
        return this.createAtTop;
    }

    public boolean isTypeLock() {
        return this.typeLock;
    }

    public List<PropertyInfo> getProperties() {
        return this.properties;
    }

    public String getShareToUserId() {
        return this.shareToUserId;
    }

    @Nullable
    public String getPayloadType() {
        return this.payloadType;
    }

    public void setNodeId(final String nodeId) {
        this.nodeId = nodeId;
    }

    public void setPendingEdit(final boolean pendingEdit) {
        this.pendingEdit = pendingEdit;
    }

    public void setContent(final String content) {
        this.content = content;
    }

    public void setNewNodeName(final String newNodeName) {
        this.newNodeName = newNodeName;
    }

    public void setTypeName(final String typeName) {
        this.typeName = typeName;
    }

    public void setCreateAtTop(final boolean createAtTop) {
        this.createAtTop = createAtTop;
    }

    public void setTypeLock(final boolean typeLock) {
        this.typeLock = typeLock;
    }

    public void setProperties(final List<PropertyInfo> properties) {
        this.properties = properties;
    }

    public void setShareToUserId(final String shareToUserId) {
        this.shareToUserId = shareToUserId;
    }

    public void setPayloadType(@Nullable final String payloadType) {
        this.payloadType = payloadType;
    }

    public String getAiService() {
        return aiService;
    }

    public void setAiService(String aiService) {
        this.aiService = aiService;
    }

    public String getAiMode() {
        return aiMode;
    }

    public void setAiMode(String aiMode) {
        this.aiMode = aiMode;
    }

    public boolean isAllowAiOverwrite() {
        return allowAiOverwrite;
    }

    public void setAllowAiOverwrite(boolean allowAiOverwrite) {
        this.allowAiOverwrite = allowAiOverwrite;
    }
    
    public CreateSubNodeRequest() {}
}
