package org.subnode.actpub.model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

public class ActPubOutbox {
    @JsonProperty("@context")
    private String context;

    @JsonProperty("summary")
    private String summary;

    @JsonProperty("type")
    private String type;

    @JsonProperty("totalItems")
    private Integer totalItems;

    @JsonProperty("items")
    private List<ActPubOutboxItem> items;
  
    public ActPubOutbox() {
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

    public List<ActPubOutboxItem> getItems() {
        return items;
    }

    public void setItems(List<ActPubOutboxItem> items) {
        this.items = items;
    }
}