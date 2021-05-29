package org.subnode.response;

import org.subnode.response.base.ResponseBase;

public class CheckMessagesResponse extends ResponseBase {
    private int numNew;

    public int getNumNew() {
        return numNew;
    }

    public void setNumNew(int numNew) {
        this.numNew = numNew;
    }
}
