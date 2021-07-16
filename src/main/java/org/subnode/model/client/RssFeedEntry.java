package org.subnode.model.client;

import java.util.List;

public class RssFeedEntry {
    private String title;
    private String image;
    private String thumbnail;
    private String description;
    private String link;
    private List<RssFeedEnclosure> enclosures;

    public String getLink() {
        return link;
    }

    public void setLink(String link) {
        this.link = link;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getImage() {
        return image;
    }

    public void setImage(String image) {
        this.image = image;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public List<RssFeedEnclosure> getEnclosures() {
        return enclosures;
    }

    public void setEnclosures(List<RssFeedEnclosure> enclosures) {
        this.enclosures = enclosures;
    }

    public String getThumbnail() {
        return thumbnail;
    }

    public void setThumbnail(String thumbnail) {
        this.thumbnail = thumbnail;
    }
}
