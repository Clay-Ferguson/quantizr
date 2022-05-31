package quanta.request;

import quanta.request.base.RequestBase;

public class GetConfigRequest extends RequestBase {
    private String appGuid;

    public String getAppGuid() {
        return appGuid;
    }

    public void setAppGuid(String appGuid) {
        this.appGuid = appGuid;
    }
}
