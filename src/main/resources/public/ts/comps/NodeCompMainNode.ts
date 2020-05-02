import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { ReactNode } from "react";
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
        super(null, {
            className: "mainNodeContentStyle inactive-row-main",
        });
    }

    super_CompRender: any = this.compRender;
    compRender = (): ReactNode => {
        let node = useSelector((state: AppState) => {return state.node;});
        if (!node) {
            return this.super_CompRender();
        }

        this.attribs.id = "row_" + node.id;
        this.attribs.onClick = (elm: HTMLElement) => { S.nav.clickOnNodeRow(node.id); };
        S.render.setNodeDropHandler(this, node);

        this.setChildren([
            new NodeCompButtonBar(node, true, false, true),
            new Div(null, { className: "clearfix" }),
            new NodeCompContent(node, false, true)
        ]);

        return this.super_CompRender();
    }
}
