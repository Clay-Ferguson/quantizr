package quanta.response;

import java.util.List;
import quanta.model.NodeInfo;
import quanta.response.base.ResponseBase;

public class GetThreadViewResponse extends ResponseBase {
    private List<NodeInfo> nodes;

    /*
     * These 'others' are the list of other nodes that are also owned by the current user and are at the
     * same level of the tree that is being queries and shows up in the GUI below the thread list
     * (nodes), and is titled "Your other[s] [Replies]...
     */
    private List<NodeInfo> others;

    private boolean topReached;

    public List<NodeInfo> getNodes() {
        return nodes;
    }

    public void setNodes(List<NodeInfo> nodes) {
        this.nodes = nodes;
    }

    public List<NodeInfo> getOthers() {
        return others;
    }

    public void setOthers(List<NodeInfo> others) {
        this.others = others;
    }

    public boolean isTopReached() {
        return topReached;
    }

    public void setTopReached(boolean topReached) {
        this.topReached = topReached;
    }
}
