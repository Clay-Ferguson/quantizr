package quanta.request;

import quanta.request.base.RequestBase;

public class GetServerInfoRequest extends RequestBase {
    
    //command to run before sending back info about the command.
    private String command;

    //currently selected node on the GUI
    private String nodeId;

    public String getCommand() {
        return command;
    }

    public String getNodeId() {
        return nodeId;
    }

    public void setNodeId(String nodeId) {
        this.nodeId = nodeId;
    }

    public void setCommand(String command) {
        this.command = command;
    }
}
