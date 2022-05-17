package quanta.response;

import quanta.response.base.ResponseBase;

public class GetIPFSContentResponse extends ResponseBase {
    private String content;

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
