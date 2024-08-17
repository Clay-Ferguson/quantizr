
package quanta.rest.response;

import quanta.rest.response.base.ResponseBase;

public class GetNodeJsonResponse extends ResponseBase {
    private String json;

    public String getJson() {
        return json;
    }

    public void setJson(String json) {
        this.json = json;
    }

    public GetNodeJsonResponse() {}
}
