package org.subnode.response;

import org.subnode.model.client.OpenGraph;
import org.subnode.response.base.ResponseBase;

public class GetOpenGraphResponse extends ResponseBase {
    private OpenGraph openGraph;

    public OpenGraph getOpenGraph() {
        return openGraph;
    }

    public void setOpenGraph(OpenGraph openGraph) {
        this.openGraph = openGraph;
    }
}
