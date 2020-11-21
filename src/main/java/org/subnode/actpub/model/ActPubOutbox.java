package org.subnode.actpub.model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

@JsonInclude(Include.NON_NULL)
public class ActPubOutbox {
    @JsonProperty("@context")
    private String context;

    //For Mastadon this appars to be the url of the outbox itself, which i'm not sure is per-spec
    @JsonProperty("id")
    private String id;

    @JsonProperty("partOf")
    private String partOf;

    @JsonProperty("type")
    private String type;

    @JsonProperty("totalItems")
    private Integer totalItems;

    @JsonProperty("first")
    private String first;

    @JsonProperty("last")
    private String last;

    @JsonProperty("orderedItems")
    private List<ActPubOutboxItem> orderedItems;
  
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

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getFirst() {
        return first;
    }

    public void setFirst(String first) {
        this.first = first;
    }

    public String getLast() {
        return last;
    }

    public void setLast(String last) {
        this.last = last;
    }

    public String getPartOf() {
        return partOf;
    }

    public void setPartOf(String partOf) {
        this.partOf = partOf;
    }

    public List<ActPubOutboxItem> getOrderedItems() {
        return orderedItems;
    }

    public void setOrderedItems(List<ActPubOutboxItem> orderedItems) {
        this.orderedItems = orderedItems;
    }
}
