import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";

import { Network, DataSet, Node, Edge, IdType } from 'vis-network';
import { Div } from "./Div";

// https://github.com/visjs/vis-network
//      npm install vis-network

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class GraphPanel extends Div {

    network: Network;

    constructor() {
        super(null, { style: { width: "100%", height: "600px", border: "1px solid gray" } });
    }

    init(): void {
        // S.util.getElm(this.getId(), (elm: HTMLElement) => {

        //     // create an array with nodes
        //     var nodes = new DataSet([
        //         { id: 1, label: 'Node 1' },
        //         { id: 2, label: 'Node 2' },
        //         { id: 3, label: 'Node 3' },
        //         { id: 4, label: 'Node 4' },
        //         { id: 5, label: 'Node 5' }
        //     ]);

        //     // create an array with edges
        //     var edges = new DataSet([
        //         { from: 1, to: 3 },
        //         { from: 1, to: 2 },
        //         { from: 2, to: 4 },
        //         { from: 2, to: 5 },
        //         { from: 3, to: 3 }
        //     ]);

        //     var data = {
        //         nodes: nodes,
        //         edges: edges
        //     };

        // });
    }

    setGraphData(data: any): void {
        this.whenElm((elm: HTMLElement) => {

            // Lazy create network, and populate with data.
            if (!this.network) {
                var options = {};
                this.network = new Network(elm, data, options);
            }
            else {
                this.network.setData(data);
            }
        });
    }

    preRender(): void {
        this.init();
    }
}

