package quanta.rest.request;

import java.util.List;
import quanta.rest.request.base.RequestBase;

public class AddPrivilegeRequest extends RequestBase {

    private String nodeId;
    /* for now only 'public' is the only option we support */
    private List<String> privileges;
    private String[] principals;

    public String getNodeId() {
        return this.nodeId;
    }

    public List<String> getPrivileges() {
        return this.privileges;
    }

    public String[] getPrincipals() {
        return this.principals;
    }

    public void setNodeId(final String nodeId) {
        this.nodeId = nodeId;
    }

    public void setPrivileges(final List<String> privileges) {
        this.privileges = privileges;
    }

    public void setPrincipals(final String[] principals) {
        this.principals = principals;
    }

    public AddPrivilegeRequest() {}
}
