package org.subnode.actpub.model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

@JsonInclude(Include.NON_NULL)
public class OrderedCollectionPage {
    @JsonProperty("@context")
    private String context;

    //For Mastadon this appars to be the url of the outbox itself, which i'm not sure is per-spec
    @JsonProperty("id")
    private String id;

    // @JsonProperty("summary")
    // private String summary;

    @JsonProperty("type")
    private String type;

    @JsonProperty("partOf")
    private String partOf;

    @JsonProperty("prev")
    private String prev;

    @JsonProperty("next")
    private String next;

    @JsonProperty("orderedItems")
    private List<ActPubOutboxItem> orderedItems;
  
    public OrderedCollectionPage() {
        context = "https://www.w3.org/ns/activitystreams";
        type = "OrderedCollectionPage";
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

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getPartOf() {
        return partOf;
    }

    public void setPartOf(String partOf) {
        this.partOf = partOf;
    }

    public String getPrev() {
        return prev;
    }

    public void setPrev(String prev) {
        this.prev = prev;
    }

    public String getNext() {
        return next;
    }

    public void setNext(String next) {
        this.next = next;
    }

    public List<ActPubOutboxItem> getOrderedItems() {
        return orderedItems;
    }

    public void setOrderedItems(List<ActPubOutboxItem> orderedItems) {
        this.orderedItems = orderedItems;
    }
}
