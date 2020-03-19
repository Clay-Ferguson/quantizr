package org.subnode.response;

import org.subnode.response.base.ResponseBase;

public class GetUserAccountInfoResponse extends ResponseBase {
	private Integer binTotal;
    private Integer binQuota;

    public Integer getBinTotal() {
        return binTotal;
    }

    public void setBinTotal(Integer binTotal) {
        this.binTotal = binTotal;
    }

    public Integer getBinQuota() {
        return binQuota;
    }

    public void setBinQuota(Integer binQuota) {
        this.binQuota = binQuota;
    }
}
