package quanta.model;

// A nodeId and the signature of the node
public class NodeSig {
    private String nodeId;
    private String sig;
    
    public String getNodeId() {
        return nodeId;
    }
    public void setNodeId(String nodeId) {
        this.nodeId = nodeId;
    }
    public String getSig() {
        return sig;
    }
    public void setSig(String sig) {
        this.sig = sig;
    }
}
