package quanta.response;

import java.util.List;
import quanta.model.NodeInfo;
import quanta.response.base.ResponseBase;

public class GetRepliesViewResponse extends ResponseBase {
    private List<NodeInfo> nodes;

    public List<NodeInfo> getNodes() {
        return nodes;
    }

    public void setNodes(List<NodeInfo> nodes) {
        this.nodes = nodes;
    }
}
