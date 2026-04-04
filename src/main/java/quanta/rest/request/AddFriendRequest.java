package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class AddFriendRequest extends RequestBase {

    private String userName;
    private String tags;

    public String getUserName() {
        return this.userName;
    }

    public void setUserName(final String userName) {
        this.userName = userName;
    }

    public String getTags() {
        return tags;
    }

    public void setTags(String tags) {
        this.tags = tags;
    }

    public AddFriendRequest() {}
}
