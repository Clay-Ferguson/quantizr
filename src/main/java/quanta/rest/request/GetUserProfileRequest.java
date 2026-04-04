
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class GetUserProfileRequest extends RequestBase {
    public String userId;

    public String getUserId() {
        return this.userId;
    }

    public void setUserId(final String userId) {
        this.userId = userId;
    }

    public GetUserProfileRequest() {}
}
