
package quanta.request;

import quanta.request.base.RequestBase;

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
