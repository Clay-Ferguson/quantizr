package org.subnode.actpub.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public class ActPubOutboxItem {
    @JsonProperty("type")
    private String type;

    @JsonProperty("name")
    private String name;

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}