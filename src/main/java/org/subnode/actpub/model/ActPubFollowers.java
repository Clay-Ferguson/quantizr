package org.subnode.actpub.model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

public class ActPubFollowers {
    @JsonProperty("@context")
    private String context;

    @JsonProperty("summary")
    private String summary;

    @JsonProperty("type")
    private String type;

    @JsonProperty("totalItems")
    private Integer totalItems;

    @JsonProperty("items")
    private List<ActPubFollower> items;
  
    public ActPubFollowers() {
        context = "https://www.w3.org/ns/activitystreams";
        type = "OrderedCollection";
    }

    public String getContext() {
        return context;
    }

    public void setContext(String context) {
        this.context = context;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Integer getTotalItems() {
        return totalItems;
    }

    public void setTotalItems(Integer totalItems) {
        this.totalItems = totalItems;
    }

    public List<ActPubFollower> getItems() {
        return items;
    }

    public void setItems(List<ActPubFollower> items) {
        this.items = items;
    }
}