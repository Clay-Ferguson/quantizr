import { DialogBase } from "../DialogBase";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Div } from "../widget/Div";
import { Form } from "../widget/Form";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Network, DataSet, Node, Edge, IdType } from 'vis-network';

// https://github.com/visjs/vis-network
//      npm install vis-network

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class GraphDisplayDlg extends DialogBase {
    graphDiv: Div;
    uploadButton: Button;

    constructor() {
        super("Graph Display");

        this.setChildren([
            new Form(null, [
                // Constants.SHOW_PATH_IN_DLGS ? new TextContent("Path: " + S.attachment.uploadNode.path, "path-display-in-editor") : null,

                this.graphDiv = new Div(null, {
                    id: "mynetwork",
                    style: { width: "100%", height: "500px", border: "1px solid red" }
                }),
                new ButtonBar([
                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ]);
    }

    init = (): void => {
        S.dom.whenElm(this.getId(), (elm: HTMLElement) => {

            // create an array with nodes
            var nodes = new DataSet([
                { id: 1, label: 'Node 1' },
                { id: 2, label: 'Node 2' },
                { id: 3, label: 'Node 3' },
                { id: 4, label: 'Node 4' },
                { id: 5, label: 'Node 5' }
            ]);

            // create an array with edges
            var edges = new DataSet([
                { from: 1, to: 3 },
                { from: 1, to: 2 },
                { from: 2, to: 4 },
                { from: 2, to: 5 },
                { from: 3, to: 3 }
            ]);

            // create a network
            var container = document.getElementById('mynetwork');
            var data = {
                nodes: nodes,
                edges: edges
            };
            var options = {};
            var network = new Network(container, data, options);
        });
    }
}

