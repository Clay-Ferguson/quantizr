package org.subnode.response;

import org.subnode.response.base.ResponseBase;

public class AddPrivilegeResponse extends ResponseBase {
    private String principalPublicKey;

    public String getPrincipalPublicKey() {
        return this.principalPublicKey;
    }

    public void setPrincipalPublicKey(String key) {
        this.principalPublicKey = key;
    }
}
