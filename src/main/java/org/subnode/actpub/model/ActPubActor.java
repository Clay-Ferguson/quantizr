package org.subnode.actpub.model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

public class ActPubActor {
    @JsonProperty("@context")
    private List<String> context;

    @JsonProperty("id")
    private String id;

    @JsonProperty("type")
    private String type;

    @JsonProperty("preferredUsername")
    private String preferredUsername;

    @JsonProperty("inbox")
    private String inbox;

    @JsonProperty("outbox")
    private String outbox;

    @JsonProperty("followers")
    private String followers;

    @JsonProperty("publickey")
    private ActPubPublicKey publickey;

    @JsonProperty("supportsFriendRequests")
    private boolean supportsFriendRequests;

    public List<String> getContext() {
        return context;
    }

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

    public boolean isSupportsFriendRequests() {
        return supportsFriendRequests;
    }

    public void setSupportsFriendRequests(boolean supportsFriendRequests) {
        this.supportsFriendRequests = supportsFriendRequests;
    }

    public String getFollowers() {
        return followers;
    }

    public void setFollowers(String followers) {
        this.followers = followers;
    }

    public String getOutbox() {
        return outbox;
    }

    public void setOutbox(String outbox) {
        this.outbox = outbox;
    }
}