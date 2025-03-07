package quanta.mongo;

import org.bson.types.ObjectId;

/*
 * userNodeId is required. userName is optional
 *
 * accessLevels: w = read/write r = readonly
 * 
 * todo-0: move to nearest above models folder
 */
public class MongoPrincipal {
    private ObjectId userNodeId;
    private String userName;
    private String accessLevel;

    public ObjectId getUserNodeId() {
        return this.userNodeId;
    }

    public String getUserName() {
        return this.userName;
    }

    public String getAccessLevel() {
        return this.accessLevel;
    }

    public void setUserNodeId(final ObjectId userNodeId) {
        this.userNodeId = userNodeId;
    }

    public void setUserName(final String userName) {
        this.userName = userName;
    }

    public void setAccessLevel(final String accessLevel) {
        this.accessLevel = accessLevel;
    }

    public MongoPrincipal() {}
}
