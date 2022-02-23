package quanta.request;

import quanta.request.base.RequestBase;

public class SendLogTextRequest extends RequestBase {
    private String text;

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }
}
