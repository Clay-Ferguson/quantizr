package org.subnode.actpub.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public class ActPubOutboxItem {
    @JsonProperty("@context")
    private String context;
    
    @JsonProperty("type")
    private String type;

    @JsonProperty("name")
    private String name;

    @JsonProperty("id")
    private String id;

    @JsonProperty("content")
    private String content;

    @JsonProperty("attributedTo")
    private String attributedTo;

    public ActPubOutboxItem() {
        context = "https://www.w3.org/ns/activitystreams";
    }

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

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getAttributedTo() {
        return attributedTo;
    }

    public void setAttributedTo(String attributedTo) {
        this.attributedTo = attributedTo;
    }

    public String getContext() {
        return context;
    }

    public void setContext(String context) {
        this.context = context;
    }
}