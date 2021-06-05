package org.subnode.model;

public class NodeMetaInfo {
    private String title;
    private String description;
    private String attachmentMime;
    private String attachmentUrl;
    private String url;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getAttachmentUrl() {
        return attachmentUrl;
    }

    public void setAttachmentUrl(String attachmentUrl) {
        this.attachmentUrl = attachmentUrl;
    }

    public String getAttachmentMime() {
        return attachmentMime;
    }

    public void setAttachmentMime(String attachmentMime) {
        this.attachmentMime = attachmentMime;
    }
}
