package quanta.response;

import com.fasterxml.jackson.annotation.JsonIgnore;
import org.springframework.data.annotation.Transient;

public class ServerPushInfo {

    /**
     * Examples: type=='newNode' nodeId=[id of the node]
     */
    @Transient
    @JsonIgnore
    private String type;

    public ServerPushInfo(String type) {
        this.type = type;
    }

    /**
     * Examples: type=='newNode' nodeId=[id of the node]
     */

    public String getType() {
        return this.type;
    }

    /**
     * Examples: type=='newNode' nodeId=[id of the node]
     */
    @JsonIgnore
    public void setType(final String type) {
        this.type = type;
    }

    public ServerPushInfo() {}
}
