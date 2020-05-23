package org.subnode.response;

import java.util.List;

import org.subnode.response.base.ResponseBase;

public class GetFriendsResponse extends ResponseBase {

    private List<FriendInfo> friends;

    public List<FriendInfo> getFriends() {
        return friends;
    }

    public void setFriends(List<FriendInfo> friends) {
        this.friends = friends;
    }
}
