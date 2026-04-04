
package quanta.rest.response;

import java.util.List;
import quanta.model.client.SearchDefinition;
import quanta.rest.response.base.ResponseBase;

public class DeleteSearchDefResponse extends ResponseBase {
    private List<SearchDefinition> searchDefs;

    public List<SearchDefinition> getSearchDefs() {
        return this.searchDefs;
    }

    public void setSearchDefs(final List<SearchDefinition> searchDefs) {
        this.searchDefs = searchDefs;
    }

    public DeleteSearchDefResponse() {}
}
