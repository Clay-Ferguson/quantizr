package quanta.request;

import quanta.request.base.RequestBase;

public class DeleteMFSFileRequest extends RequestBase {
    private String item;

    public String getItem() {
        return item;
    }

    public void setItem(String item) {
        this.item = item;
    }   
}
