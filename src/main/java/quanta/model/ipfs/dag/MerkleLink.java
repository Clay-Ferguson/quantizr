package quanta.model.ipfs.dag;

import com.fasterxml.jackson.annotation.JsonProperty;

public class MerkleLink {
    @JsonProperty("Name")
    private String name;

    @JsonProperty("Hash")
    private String hash;

    @JsonProperty("Size")
    private Integer size;

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
}