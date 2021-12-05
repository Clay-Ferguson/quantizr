package org.subnode.model.ipfs.dag;

import com.fasterxml.jackson.annotation.JsonProperty;

public class DagLink {
    @JsonProperty("Cid")
    private DagCid cid;

    @JsonProperty("Name")
    private String name;

    @JsonProperty("Size")
    private int size;

    public DagCid getCid() {
        return cid;
    }
    public void setCid(DagCid cid) {
        this.cid = cid;
    }
    public String getName() {
        return name;
    }
    public void setName(String name) {
        this.name = name;
    }
    public int getSize() {
        return size;
    }
    public void setSize(int size) {
        this.size = size;
    }
}