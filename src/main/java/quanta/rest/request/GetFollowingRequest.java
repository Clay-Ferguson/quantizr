
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class GetFollowingRequest extends RequestBase {
    private int page;
    private String targetUserName; 
    
    public int getPage() {
        return this.page;
    }

    public String getTargetUserName() {
        return this.targetUserName;
    }
    
    public void setPage(final int page) {
        this.page = page;
    }
    
    public void setTargetUserName(final String targetUserName) {
        this.targetUserName = targetUserName;
    }
    
    public GetFollowingRequest() {
    }
}
