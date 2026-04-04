
package quanta.rest.request;

import quanta.model.client.SearchDefinition;
import quanta.rest.request.base.RequestBase;

public class RenderDocumentRequest extends RequestBase {
    private String rootId;
    private boolean includeComments;
    private SearchDefinition searchDefinition; // optional

    public SearchDefinition getSearchDefinition() {
        return searchDefinition;
    }

    public void setSearchDefinition(SearchDefinition searchDefinition) {
        this.searchDefinition = searchDefinition;
    }

    public String getRootId() {
        return this.rootId;
    }

    public boolean isIncludeComments() {
        return this.includeComments;
    }

    public void setRootId(final String rootId) {
        this.rootId = rootId;
    }

    public void setIncludeComments(final boolean includeComments) {
        this.includeComments = includeComments;
    }

    public RenderDocumentRequest() {}
}
