package quanta.request;

import quanta.request.base.RequestBase;

public class GetIPFSFilesRequest extends RequestBase {
    private String folder;

    public String getFolder() {
        return folder;
    }

    public void setFolder(String folder) {
        this.folder = folder;
    }
}
