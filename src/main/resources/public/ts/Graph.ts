import * as I from "./Interfaces";
import * as J from "./JavaIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C} from "./Constants";
import { GraphIntf } from "./intf/GraphIntf";
import { Network, DataSet, Node, Edge, IdType } from 'vis-network';

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Graph implements GraphIntf {
    graphTreeStructure = () => {
        let nodeId = S.meta64.state.highlightNode.id;
        S.util.ajax<J.GraphRequest, J.GraphResponse>("graphNodes", {
            "nodeId": nodeId,
        }, this.graphNodesResponse);
    }

    graphNodesResponse = (res: J.GraphResponse) => {
        //console.log(S.util.prettyPrint(res));
        S.meta64.graphPanel.setGraphData({nodes: res.nodes, edges: res.edges});
        S.meta64.selectTab("graphTab");
    }
}
