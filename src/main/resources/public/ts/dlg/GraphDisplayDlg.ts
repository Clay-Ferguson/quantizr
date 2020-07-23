/* Graph code is temporarily disabled */
import { DialogBase } from "../DialogBase";
import { Button } from "../widget/Button";
import { Div } from "../widget/Div";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
//import { Network, DataSet, Node, Edge, IdType } from 'vis-network';
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

// https://github.com/visjs/vis-network
//      npm install vis-network

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class GraphDisplayDlg extends DialogBase {
    graphDiv: Div;
    uploadButton: Button;

    constructor(state: AppState) {
        super("Graph Display", null, false, state);
    }

    renderDlg(): CompIntf[] {
        // Commenting this whole method out because something in the typesafety changed, and we currently aren't using this code anyway.
        // to enable need to reinstall this into npm package.json: 
        //     "vis-network": "^5.4.1",
        // let children = [
        //     new Form(null, [
        //         this.graphDiv = new Div(null, {
        //             id: "mynetwork",
        //             style: { width: "100%", height: "500px", border: "1px solid red" }
        //         }),
        //         new ButtonBar([
        //             new Button("Close", () => {
        //                 this.close();
        //             })
        //         ])
        //     ])
        // ];

        // this.whenElm((elm: HTMLElement) => {

        //     // create an array with nodes
        //     let nodes = new DataSet([
        //         { id: 1, label: 'Node 1' },
        //         { id: 2, label: 'Node 2' },
        //         { id: 3, label: 'Node 3' },
        //         { id: 4, label: 'Node 4' },
        //         { id: 5, label: 'Node 5' }
        //     ]);

        //     // create an array with edges
        //     let edges = new DataSet([
        //         { from: 1, to: 3 },
        //         { from: 1, to: 2 },
        //         { from: 2, to: 4 },
        //         { from: 2, to: 5 },
        //         { from: 3, to: 3 }
        //     ]);

        //     // create a network
        //     var container = document.getElementById('mynetwork');
        //     var data = {
        //         nodes: nodes,
        //         edges: edges
        //     };
        //     var options = {};
        //     var network = new Network(container, data, options);
        // });
        // return children;
        return [];
    }

    renderButtons(): CompIntf {
        return null;
    }
}

