package quanta.response;

import java.util.List;
import quanta.model.NodeInfo;
import quanta.response.base.ResponseBase;

public class GetThreadViewResponse extends ResponseBase {
    private List<NodeInfo> nodes;
    private boolean topReached;

    public List<NodeInfo> getNodes() {
        return nodes;
    }

    public void setNodes(List<NodeInfo> nodes) {
        this.nodes = nodes;
    }

    public boolean isTopReached() {
        return topReached;
    }

    public void setTopReached(boolean topReached) {
        this.topReached = topReached;
    }
}
