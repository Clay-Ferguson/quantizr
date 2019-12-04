package org.subnode.actpub.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public class ActPubCreate {
    private String context;
    private String id;
    private String type;
    private String actor;
    private ActPubObject object;

    @JsonProperty("@context")
    public String getContext() {
        return context;
    }

    @JsonProperty("@context")
    public void setContext(String context) {
        this.context = context;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getActor() {
        return actor;
    }

    public void setActor(String actor) {
        this.actor = actor;
    }

    public ActPubObject getObject() {
        return object;
    }

    public void setObject(ActPubObject object) {
        this.object = object;
    }
}