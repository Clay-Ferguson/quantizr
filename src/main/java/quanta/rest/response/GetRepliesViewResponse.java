
package quanta.rest.response;

import java.util.List;
import quanta.model.NodeInfo;
import quanta.rest.response.base.ResponseBase;

public class GetRepliesViewResponse extends ResponseBase {
    private List<NodeInfo> nodes;
    
    public List<NodeInfo> getNodes() {
        return this.nodes;
    }
    
    public void setNodes(final List<NodeInfo> nodes) {
        this.nodes = nodes;
    }

    public GetRepliesViewResponse() {
    }
}
