package org.subnode.model.client;

import java.util.List;

public class RssFeed {
    private String encoding;
    private String title;
    private String description;
    private String author;
    private String link;
    private String image;
    private List<RssFeedEntry> entries;

    public String getEncoding() {
        return encoding;
    }

    public void setEncoding(String encoding) {
        this.encoding = encoding;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }

    public String getLink() {
        return link;
    }

    public void setLink(String link) {
        this.link = link;
    }

    public String getImage() {
        return image;
    }

    public void setImage(String image) {
        this.image = image;
    }

    public List<RssFeedEntry> getEntries() {
        return entries;
    }

    public void setEntries(List<RssFeedEntry> entries) {
        this.entries = entries;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }
}
