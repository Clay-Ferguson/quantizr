package quanta.model.client;

import java.util.List;

public class RssFeedEntry {
    private String parentFeedTitle;
    private String author;
    private String title;
    private String subTitle;
    private String publishDate;
    private String image;
    private String thumbnail;
    private String description;
    private String link;
    private List<RssFeedEnclosure> enclosures;
    private List<RssFeedMediaContent> mediaContent;

    public List<RssFeedMediaContent> getMediaContent() {
        return mediaContent;
    }

    public void setMediaContent(List<RssFeedMediaContent> mediaContent) {
        this.mediaContent = mediaContent;
    }

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

    public String getPublishDate() {
        return publishDate;
    }

    public void setPublishDate(String publishDate) {
        this.publishDate = publishDate;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }

    public String getSubTitle() {
        return subTitle;
    }

    public void setSubTitle(String subTitle) {
        this.subTitle = subTitle;
    }

    public String getParentFeedTitle() {
        return parentFeedTitle;
    }

    public void setParentFeedTitle(String parentFeedTitle) {
        this.parentFeedTitle = parentFeedTitle;
    }
}
