package quanta.response;

public class FriendInfo {

    private String displayName;
    private String userName;
    private String avatarVer;
    private String userNodeId;

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

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }
}
