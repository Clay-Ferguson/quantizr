import * as I from "./Interfaces";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";
import { GraphIntf } from "./intf/GraphIntf";
import { Network, DataSet, Node, Edge, IdType } from 'vis-network';

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Graph implements GraphIntf {
    graphTreeStructure = () => {
        let nodeId = S.meta64.state.highlightNode.id;
        S.util.ajax<I.GraphRequest, I.GraphResponse>("graphNodes", {
            "nodeId": nodeId,
        }, this.graphNodesResponse);
    }

    graphNodesResponse = (res: I.GraphResponse) => {
        //console.log(S.util.prettyPrint(res));
        S.meta64.graphPanel.setGraphData({nodes: res.nodes, edges: res.edges});
        S.meta64.selectTab("graphTab");
    }
}
