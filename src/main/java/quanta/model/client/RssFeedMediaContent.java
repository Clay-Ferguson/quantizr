package quanta.model.client;

public class RssFeedMediaContent {
    private String type;
    private String url;
    private String medium;

    public String getType() {
        return type;
    }

    public String getMedium() {
        return medium;
    }

    public void setMedium(String medium) {
        this.medium = medium;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }
}
