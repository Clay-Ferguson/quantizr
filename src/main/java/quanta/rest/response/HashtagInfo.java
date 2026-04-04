
package quanta.rest.response;

import java.util.List;

public class HashtagInfo {
    private String hashtag;
    private List<String> usedWith;

    public HashtagInfo() {}

    public String getHashtag() {
        return this.hashtag;
    }

    public List<String> getUsedWith() {
        return this.usedWith;
    }

    public void setHashtag(final String hashtag) {
        this.hashtag = hashtag;
    }

    public void setUsedWith(final List<String> usedWith) {
        this.usedWith = usedWith;
    }
}
