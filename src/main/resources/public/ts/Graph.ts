/* Graph code is temporarily disabled */
// import { Network, DataSet, Node, Edge, IdType } from 'vis-network';
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { GraphIntf } from "./intf/GraphIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Graph implements GraphIntf {
    graphTreeStructure = (state: AppState) => {
        const highlightNode = S.meta64.getHighlightedNode(state);
        if (!highlightNode) {
            return;
        }
        const nodeId = highlightNode.id;
        S.util.ajax<J.GraphRequest, J.GraphResponse>("graphNodes", {
            nodeId
        }, this.graphNodesResponse);
    }

    graphNodesResponse = (res: J.GraphResponse) => {
        // console.log(S.util.prettyPrint(res));

        // graphPanel var went away. This will have to be done with AppState now.
        // S.meta64.graphPanel.setGraphData({nodes: res.nodes, edges: res.edges});
        // S.meta64.selectTab("graphTab");
    }
}
