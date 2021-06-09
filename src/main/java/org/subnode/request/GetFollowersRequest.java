package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class GetFollowersRequest extends RequestBase {
    private int page;

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = page;
    }
}
