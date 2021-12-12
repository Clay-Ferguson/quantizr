package quanta.response;

import quanta.response.base.ResponseBase;

public class CheckMessagesResponse extends ResponseBase {
    private int numNew;

    public int getNumNew() {
        return numNew;
    }

    public void setNumNew(int numNew) {
        this.numNew = numNew;
    }
}
