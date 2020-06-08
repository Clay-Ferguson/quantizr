package org.subnode.model;

import java.util.LinkedList;
import java.util.List;

/* Contains user's N most recent posts to their UserFeed */
public class UserFeedInfo {
    private String userName;
    private List<UserFeedItem> userFeedList = new LinkedList<UserFeedItem>();

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public List<UserFeedItem> getUserFeedList() {
        return userFeedList;
    }

    public void setUserFeedList(List<UserFeedItem> userFeedList) {
        this.userFeedList = userFeedList;
    }
}