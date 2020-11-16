package org.subnode.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public class IPFSDirEntry {
    @JsonProperty("Name")
    private String name;

    @JsonProperty("Type")
    private Integer type;
    
    @JsonProperty("Size")
    private Integer size;
    
    @JsonProperty("Hash")
    private Integer hash;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getType() {
        return type;
    }

    public void setType(Integer type) {
        this.type = type;
    }

    public Integer getSize() {
        return size;
    }

    public void setSize(Integer size) {
        this.size = size;
    }

    public Integer getHash() {
        return hash;
    }

    public void setHash(Integer hash) {
        this.hash = hash;
    }
}