package quanta.response;

import java.util.List;

import quanta.model.AccessControlInfo;
import quanta.response.base.ResponseBase;

public class GetNodePrivilegesResponse extends ResponseBase {
	private List<AccessControlInfo> aclEntries;
	private List<String> owners;

	public List<AccessControlInfo> getAclEntries() {
		return aclEntries;
	}

	public void setAclEntries(List<AccessControlInfo> aclEntries) {
		this.aclEntries = aclEntries;
	}

	public List<String> getOwners() {
		return owners;
	}

	public void setOwners(List<String> owners) {
		this.owners = owners;
	}
}
