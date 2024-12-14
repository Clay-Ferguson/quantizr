package quanta.config;

import java.util.HashMap;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Transient;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import quanta.model.UserPreferences;
import quanta.model.client.PrincipalName;
import quanta.service.UserManagerService;

/**
 * Session object holding state per user session.
 *
 * 1: Need to refactor so that the only session-specific data are things that apply to THIS server
 * node instance and wouldn't be something that would make load balancer nodes have issues.
 *
 * Serializable for saving to Redis
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class SessionContext {
    private String command;
    private boolean live = true;

    /*
     * When the user does a "Timeline" search we store the path of the node the timeline was done on so
     * that with a simple substring search, we can detect any time a new node is added that would've
     * appeared in the timeline and then do a server push to browsers of any new nodes, thereby creating
     * a realtime view of the timeline
     */
    private String timelinePath;

    private boolean viewingFeed;
    private String userName = PrincipalName.ANON.s();
    private String userNodeId;

    @Transient
    @JsonIgnore
    private ObjectId userNodeObjId; // we construct this object lazily from userNodeId in the getter

    private String timezone;
    private String timeZoneAbbrev;
    private long lastLoginTime;
    private long lastActiveTime;
    private UserPreferences userPreferences;
    private String userToken;

    // this gets set to true, to trigger a refresh when needed again.
    private boolean friendsTagsDirty;

    /*
     * Keeps track of expansion states set by user. We can't just use a set to represent expanded nodes,
     * because we need to know if a node is expanded or not, based on an actual action taken by the
     * user.
     */
    private HashMap<String, Boolean> nodeExpandStates = new HashMap<>();

    public SessionContext() {}

    // Extra layer of security to invalidate this session object
    public void forceAnonymous() {
        userToken = null;
        userName = PrincipalName.ANON.s();
        userNodeId = null;
        userNodeObjId = null;
        timelinePath = null;
    }

    public String getUserToken() {
        return userToken;
    }

    public void setUserToken(String userToken) {
        this.userToken = userToken;
    }

    public boolean isAdmin() {
        return PrincipalName.ADMIN.s().equalsIgnoreCase(userName);
    }

    public boolean isAnon() {
        return PrincipalName.ANON.s().equalsIgnoreCase(userName);
    }

    public boolean isTestAccount() {
        return UserManagerService.isTestAccountName(userName);
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public String getTimeZoneAbbrev() {
        return timeZoneAbbrev;
    }

    public void setTimeZoneAbbrev(String timeZoneAbbrev) {
        this.timeZoneAbbrev = timeZoneAbbrev;
    }

    public UserPreferences getUserPreferences() {
        return userPreferences;
    }

    public void setUserPreferences(UserPreferences userPreferences) {
        this.userPreferences = userPreferences;
    }

    public long getLastLoginTime() {
        return lastLoginTime;
    }

    public void setLastLoginTime(long lastLoginTime) {
        this.lastLoginTime = lastLoginTime;
    }

    public long getLastActiveTime() {
        return lastActiveTime;
    }

    public void setLastActiveTime(long lastActiveTime) {
        this.lastActiveTime = lastActiveTime;
    }

    public String getTimelinePath() {
        return timelinePath;
    }

    public void setTimelinePath(String timelinePath) {
        this.timelinePath = timelinePath;
    }

    public boolean isViewingFeed() {
        return viewingFeed;
    }

    public void setViewingFeed(boolean viewingFeed) {
        this.viewingFeed = viewingFeed;
    }

    public boolean isLive() {
        return live;
    }

    public void setLive(boolean live) {
        this.live = live;
    }

    public String getUserNodeId() {
        return userNodeId;
    }

    @Transient
    @JsonIgnore
    public ObjectId getUserNodeObjId() {
        if (userNodeObjId == null && userNodeId != null) {
            userNodeObjId = new ObjectId(userNodeId);
        }
        return userNodeObjId;
    }

    public void setUserNodeId(String userNodeId) {
        this.userNodeId = userNodeId;
        this.userNodeObjId = null;
    }

    public boolean isFriendsTagsDirty() {
        return friendsTagsDirty;
    }

    public void setFriendsTagsDirty(boolean friendsTagsDirty) {
        this.friendsTagsDirty = friendsTagsDirty;
    }

    public String getCommand() {
        return command;
    }

    public void setCommand(String command) {
        this.command = command;
    }

    public HashMap<String, Boolean> getNodeExpandStates() {
        return nodeExpandStates;
    }

    public void setNodeExpandStates(HashMap<String, Boolean> nodeExpandStates) {
        this.nodeExpandStates = nodeExpandStates;
    }
}
