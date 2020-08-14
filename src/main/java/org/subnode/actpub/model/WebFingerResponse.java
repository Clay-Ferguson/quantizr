package org.subnode.actpub.model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

public class WebFingerResponse {
    @JsonProperty("subject")
    private String subject;
    
    @JsonProperty("links")
    private List<WebFingerLink> links;

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public List<WebFingerLink> getLinks() {
        return links;
    }

    public void setLinks(List<WebFingerLink> links) {
        this.links = links;
    }
}