package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class GetFollowersRequest extends RequestBase {
    private int page;

    /* user to get followers of (if this is a foreign user, of course it needs to go thru ActivityPub) */
    private String targetUserName;

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = page;
    }

    public String getTargetUserName() {
        return targetUserName;
    }

    public void setTargetUserName(String targetUserName) {
        this.targetUserName = targetUserName;
    }
}
