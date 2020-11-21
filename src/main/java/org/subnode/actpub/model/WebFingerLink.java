package org.subnode.actpub.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class WebFingerLink {
    @JsonProperty("rel")
    private String rel;

    @JsonProperty("type")
    private String type;

    @JsonProperty("href")
    private String href;

    public String getRel() {
        return rel;
    }

    public String getHref() {
        return href;
    }

    public void setHref(String href) {
        this.href = href;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public void setRel(String rel) {
        this.rel = rel;
    }
}