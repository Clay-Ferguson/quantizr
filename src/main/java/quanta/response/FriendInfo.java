package quanta.response;

public class FriendInfo {

    private String displayName;
    private String userName;
    private String avatarVer;
    private String userNodeId;
    private String friendNodeId;
    private String foreignAvatarUrl;
    private String tags;

    // indicates this user liked some node, and is dependent upon use case where this FriendInfo is being used
    private Boolean liked;

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public String getAvatarVer() {
        return avatarVer;
    }

    public void setAvatarVer(String avatarVer) {
        this.avatarVer = avatarVer;
    }

    public String getUserNodeId() {
        return userNodeId;
    }

    public void setUserNodeId(String userNodeId) {
        this.userNodeId = userNodeId;
    }

    public String getFriendNodeId() {
        return friendNodeId;
    }

    public void setFriendNodeId(String friendNodeId) {
        this.friendNodeId = friendNodeId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getForeignAvatarUrl() {
        return foreignAvatarUrl;
    }

    public void setForeignAvatarUrl(String foreignAvatarUrl) {
        this.foreignAvatarUrl = foreignAvatarUrl;
    }

    public Boolean getLiked() {
        return liked;
    }

    public void setLiked(Boolean liked) {
        this.liked = liked;
    }

    public String getTags() {
        return tags;
    }

    public void setTags(String tags) {
        this.tags = tags;
    }
}
