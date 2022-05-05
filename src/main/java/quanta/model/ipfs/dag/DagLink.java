package quanta.model.ipfs.dag;

import com.fasterxml.jackson.annotation.JsonProperty;

public class DagLink {
    @JsonProperty("Name")
    private String name;

    @JsonProperty("Hash")
    private MerkleCid hash;

    @JsonProperty("Tsize")
    private Integer size;

    public MerkleCid getHash() {
        return hash;
    }

    public void setHash(MerkleCid hash) {
        this.hash = hash;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getTsize() {
        return this.size;
    }

    public void setTsize(Integer size) {
        this.size = size;
    }
}
