import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Div } from "../widget/Div";
import { NodeCompButtonBar } from "./NodeCompButtonBar";
import { NodeCompContent } from "./NodeCompContent";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "../AppState";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompMainNode extends Div {

    constructor() {
        super();
    }

    preRender = (): void => {
        let state: AppState = useSelector((state: AppState) => state);
        let node = state.node;

        if (!node) {
            this.children = null;
            return;
        }
        
        let focusNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
        let selected: boolean = (focusNode && focusNode.id === node.id);
        this.attribs.className = "mainNodeContentStyle " + (selected ? "active-row-main" : "inactive-row-main")

        this.attribs.id = "row_" + node.id;
        this.attribs.onClick = (elm: HTMLElement) => { S.nav.clickOnNodeRow(node, state); };
        S.render.setNodeDropHandler(this, node, state);

        this.setChildren([
            new NodeCompButtonBar(node, true, false, true),
            new Div(null, { className: "clearfix" }),
            new NodeCompContent(node, false, true)
        ]);
    }
}
