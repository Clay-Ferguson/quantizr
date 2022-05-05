package quanta.model.ipfs.dag;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonProperty;

public class DagNode {

    // don't need this, make it an Object for now.
    @JsonProperty("Data")
    private Object data;

    @JsonProperty("Links")
    private List<DagLink> links;

    public Object getData() {
        return data;
    }

    public void setData(Object data) {
        this.data = data;
    }

    public List<DagLink> getLinks() {
        return links;
    }

    public void setLinks(List<DagLink> links) {
        this.links = links;
    }
}