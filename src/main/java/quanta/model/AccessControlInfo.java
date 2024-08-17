package quanta.model;

import java.util.LinkedList;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

/**
 * Represents a certain principal and a set of privileges the principal has.
 */
@JsonInclude(Include.NON_NULL)
public class AccessControlInfo {

    private String displayName;
    private String principalName;
    private String principalNodeId;

    // used to build local user avatars
    private String avatarVer;
    private List<PrivilegeInfo> privileges;
    private String publicKey;

    public AccessControlInfo(String displayName, String principalName, String principalNodeId, String publicKey,
            String avatarVer) {
        this.displayName = displayName;
        this.principalName = principalName;
        this.principalNodeId = principalNodeId;
        this.publicKey = publicKey;
        this.avatarVer = avatarVer;
    }

    public void addPrivilege(PrivilegeInfo priv) {
        if (privileges == null) {
            privileges = new LinkedList<>();
        }
        privileges.add(priv);
    }

    public String getDisplayName() {
        return this.displayName;
    }

    public String getPrincipalName() {
        return this.principalName;
    }

    public String getPrincipalNodeId() {
        return this.principalNodeId;
    }

    public String getAvatarVer() {
        return this.avatarVer;
    }

    public List<PrivilegeInfo> getPrivileges() {
        return this.privileges;
    }

    public String getPublicKey() {
        return this.publicKey;
    }

    public void setDisplayName(final String displayName) {
        this.displayName = displayName;
    }

    public void setPrincipalName(final String principalName) {
        this.principalName = principalName;
    }

    public void setPrincipalNodeId(final String principalNodeId) {
        this.principalNodeId = principalNodeId;
    }

    public void setAvatarVer(final String avatarVer) {
        this.avatarVer = avatarVer;
    }

    public void setPrivileges(final List<PrivilegeInfo> privileges) {
        this.privileges = privileges;
    }

    public void setPublicKey(final String publicKey) {
        this.publicKey = publicKey;
    }

    public AccessControlInfo() {}
}
