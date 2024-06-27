
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class GetNodeStatsRequest extends RequestBase {
    private String nodeId;
    private boolean signatureVerify;
    private boolean getWords;
    private boolean getTags;

    public String getNodeId() {
        return this.nodeId;
    }

    public boolean isSignatureVerify() {
        return this.signatureVerify;
    }

    public boolean isGetWords() {
        return this.getWords;
    }

    public boolean isGetTags() {
        return this.getTags;
    }

    public void setNodeId(final String nodeId) {
        this.nodeId = nodeId;
    }

    public void setSignatureVerify(final boolean signatureVerify) {
        this.signatureVerify = signatureVerify;
    }

    public void setGetWords(final boolean getWords) {
        this.getWords = getWords;
    }

    public void setGetTags(final boolean getTags) {
        this.getTags = getTags;
    }

    public GetNodeStatsRequest() {}
}
