
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class SaveNodeJsonRequest extends RequestBase {
    private String json;

    public String getJson() {
        return json;
    }

    public void setJson(String json) {
        this.json = json;
    }

    public SaveNodeJsonRequest() {}
}
