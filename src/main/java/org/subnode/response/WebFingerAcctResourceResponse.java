package org.subnode.response;

import java.util.List;

import org.subnode.actpub.model.WebFingerLink;

public class WebFingerAcctResourceResponse {
    private String subject;
    private List<WebFingerLink> links;

    public String getSubject() {
        return subject;
    }

    public List<WebFingerLink> getLinks() {
        return links;
    }

    public void setLinks(List<WebFingerLink> links) {
        this.links = links;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }
}
