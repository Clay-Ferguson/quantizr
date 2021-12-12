package quanta.response;

import quanta.model.client.OpenGraph;
import quanta.response.base.ResponseBase;

public class GetOpenGraphResponse extends ResponseBase {
    private OpenGraph openGraph;

    public OpenGraph getOpenGraph() {
        return openGraph;
    }

    public void setOpenGraph(OpenGraph openGraph) {
        this.openGraph = openGraph;
    }
}
