package org.subnode.model.ipfs.file;

import com.fasterxml.jackson.annotation.JsonProperty;

public class IPFSDirStat {

    @JsonProperty("Hash")
    private String hash;

    @JsonProperty("Size")
    private Integer size;

    @JsonProperty("CumulativeSize")
    private Integer cumulativeSize;

    @JsonProperty("Blocks")
    private Integer blocks;

    @JsonProperty("Type")
    private String type;

    public String getHash() {
        return hash;
    }

    public void setHash(String hash) {
        this.hash = hash;
    }

    public Integer getSize() {
        return size;
    }

    public void setSize(Integer size) {
        this.size = size;
    }

    public Integer getCumulativeSize() {
        return cumulativeSize;
    }

    public void setCumulativeSize(Integer cumulativeSize) {
        this.cumulativeSize = cumulativeSize;
    }

    public Integer getBlocks() {
        return blocks;
    }

    public void setBlocks(Integer blocks) {
        this.blocks = blocks;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}