package org.subnode.model.ipfs.file;

import com.fasterxml.jackson.annotation.JsonProperty;

public class IPFSObjectStat {

    @JsonProperty("BlockSize")
    private Integer blockSize;

    @JsonProperty("CumulativeSize")
    private Integer cumulativeSize;

    @JsonProperty("DataSize")
    private Integer dataSize;

    @JsonProperty("Hash")
    private String hash;

    @JsonProperty("LinksSize")
    private Integer linksSize;

    @JsonProperty("NumLinks")
    private Integer numLinks;

    public Integer getBlockSize() {
        return blockSize;
    }

    public void setBlockSize(Integer blockSize) {
        this.blockSize = blockSize;
    }

    public Integer getCumulativeSize() {
        return cumulativeSize;
    }

    public void setCumulativeSize(Integer cumulativeSize) {
        this.cumulativeSize = cumulativeSize;
    }

    public Integer getDataSize() {
        return dataSize;
    }

    public void setDataSize(Integer dataSize) {
        this.dataSize = dataSize;
    }

    public String getHash() {
        return hash;
    }

    public void setHash(String hash) {
        this.hash = hash;
    }

    public Integer getLinksSize() {
        return linksSize;
    }

    public void setLinksSize(Integer linksSize) {
        this.linksSize = linksSize;
    }

    public Integer getNumLinks() {
        return numLinks;
    }

    public void setNumLinks(Integer numLinks) {
        this.numLinks = numLinks;
    }
}