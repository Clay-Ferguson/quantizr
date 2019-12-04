package org.subnode.actpub.model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

public class ActPubActor {
    private List<String> context;
    private String id;
    private String type;
    private String preferredUsername;
    private String inbox;
    private ActPubPublicKey publickey;

    @JsonProperty("@context")
    public List<String> getContext() {
        return context;
    }

    @JsonProperty("@context")
    public void setContext(List<String> context) {
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

    public ActPubPublicKey getPublickey() {
        return publickey;
    }

    public void setPublickey(ActPubPublicKey publickey) {
        this.publickey = publickey;
    }

    public String getInbox() {
        return inbox;
    }

    public void setInbox(String inbox) {
        this.inbox = inbox;
    }

    public String getPreferredUsername() {
        return preferredUsername;
    }

    public void setPreferredUsername(String preferredUsername) {
        this.preferredUsername = preferredUsername;
    }

}