
package quanta.rest.response;

import java.util.List;
import quanta.model.AccessControlInfo;
import quanta.rest.response.base.ResponseBase;

public class AddPrivilegeResponse extends ResponseBase {
    private String principalPublicKey;
    /*
     * we send this back to the client, for use as the more efficient way to identify the user after the
     * browser encrypts a key to send back to the server
     */
    private String principalNodeId;

    // returns back to server the acl entries, in case encryption keys need to be processed (optional)
    private List<AccessControlInfo> aclEntries;

    public String getPrincipalPublicKey() {
        return this.principalPublicKey;
    }

    public String getPrincipalNodeId() {
        return this.principalNodeId;
    }

    public void setPrincipalPublicKey(final String principalPublicKey) {
        this.principalPublicKey = principalPublicKey;
    }

    public void setPrincipalNodeId(final String principalNodeId) {
        this.principalNodeId = principalNodeId;
    }

    public List<AccessControlInfo> getAclEntries() {
        return this.aclEntries;
    }

    public void setAclEntries(final List<AccessControlInfo> aclEntries) {
        this.aclEntries = aclEntries;
    }

    public AddPrivilegeResponse() {}
}
