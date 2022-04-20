package quanta.model.ipfs.dag;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonProperty;

/* todo-0: This is duplicate of MerkleNode right? Consolidate them */
/*
 * This is very similar to MerkleLink, but I'm not sure if they should be the SAME, because if so it
 * means IPFS has changed things, not us
 */
public class DagNode {

    @JsonProperty("links")
    private List<DagLink> links;

    @JsonProperty("data")
    private String data;

    public List<DagLink> getLinks() {
        return links;
    }

    public void setLinks(List<DagLink> links) {
        this.links = links;
    }

    public String getData() {
        return data;
    }

    public void setData(String data) {
        this.data = data;
    }
}
