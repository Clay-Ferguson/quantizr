package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class DeleteSearchDefRequest extends RequestBase {
    private String searchDefName;

    public DeleteSearchDefRequest() {}

    public String getSearchDefName() {
        return this.searchDefName;
    }

    public void setSearchDefName(final String searchDefName) {
        this.searchDefName = searchDefName;
    }
}
