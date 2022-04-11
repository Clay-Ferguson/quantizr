package quanta.model.ipfs.dag;

import java.util.HashMap;
import com.fasterxml.jackson.annotation.JsonProperty;

public class MerkleLink {
    @JsonProperty("Name")
    private String name;

    // did this get renmaed to Cid? or is still in addition to?
    @JsonProperty("Hash")
    private String hash;

    @JsonProperty("Size")
    private Integer size;

    // This will be someting like:
    // {"/": "<cid-string>" }
    @JsonProperty("Cid")
    private HashMap<String, Object> cid;

    public String getName() {
        return name;
    }

    public String getHash() {
        return hash;
    }

    public void setHash(String hash) {
        this.hash = hash;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getSize() {
        return this.size;
    }

    public void setSize(Integer size) {
        this.size = size;
    }

    public HashMap<String, Object> getCid() {
        return cid;
    }

    public void setCid(HashMap<String, Object> cid) {
        this.cid = cid;
    }
}
