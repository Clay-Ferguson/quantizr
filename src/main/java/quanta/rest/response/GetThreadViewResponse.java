
package quanta.rest.response;

import java.util.List;
import quanta.model.NodeInfo;
import quanta.rest.response.base.ResponseBase;

public class GetThreadViewResponse extends ResponseBase {
    private List<NodeInfo> nodes;
    private boolean topReached;

    public List<NodeInfo> getNodes() {
        return this.nodes;
    }

    public boolean isTopReached() {
        return this.topReached;
    }

    public void setNodes(final List<NodeInfo> nodes) {
        this.nodes = nodes;
    }

    public void setTopReached(final boolean topReached) {
        this.topReached = topReached;
    }

    public GetThreadViewResponse() {}
}
