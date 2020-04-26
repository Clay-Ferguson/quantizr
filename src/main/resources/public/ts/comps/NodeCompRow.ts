import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Comp } from "../widget/base/Comp";
import { ReactNode } from "react";
import { NodeCompButtonBar } from "./NodeCompButtonBar";
import { Div } from "../widget/Div";
import { NodeCompContent } from "./NodeCompContent";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompRow extends Comp {

    comp: Comp = null;

    constructor(public node: J.NodeInfo, public index: number, public count: number, public rowCount: number, public level: number, public layoutClass: string, public allowNodeMove: boolean) {
        super();
        this.comp = this.build();
    }

    build = (): Comp => {
        let node = this.node;
        let id: string = node.id;
        //console.log("Rendering Node Row[" + index + "] editingAllowed=" + editingAllowed);

        /*
         * if not selected by being the new child, then we try to select based on if this node was the last one
         * clicked on for this page.
         */
        // console.log("test: [" + parentIdToFocusIdMap[currentNodeId]
        // +"]==["+ node.id + "]")
        let focusNode: J.NodeInfo = S.meta64.getHighlightedNode();
        let selected: boolean = (focusNode && focusNode.id === id);

        //console.log("owner=" + node.owner + " lastOwner=" + this.lastOwner);
        let allowAvatar = node.owner != S.render.lastOwner;
        let buttonBar: Comp = new NodeCompButtonBar(node, allowAvatar, this.allowNodeMove, false);

        let indentLevel = this.layoutClass === "node-grid-item" ? 0 : this.level;
        let style = indentLevel > 0 ? { marginLeft: "" + ((indentLevel - 1) * 30) + "px" } : null;
        let cssId: string = "row_" + id;

        let activeClass;
        let inactiveClass;

        if (node.id == S.meta64.currentNodeData.node.id) {
            activeClass = "active-row-main";
            inactiveClass = "inactive-row-main";
        }
        else {
            activeClass = "active-row";
            inactiveClass = "inactive-row";
        }

        let rowDiv = new Div(null, {
            className: this.layoutClass + (selected ? (" " + activeClass) : (" " + inactiveClass)),
            onClick: (evt) => { S.nav.clickOnNodeRow(id); }, //
            id: cssId,
            style: style
        },
            [
                buttonBar,
                new Div(null, { className: "clearfix" }),
                new NodeCompContent(node, true, true)
            ]);

        S.render.setNodeDropHandler(rowDiv, node);
        return rowDiv;
    }

    compRender = () : ReactNode => {
        /* Delegate rendering to comp */
        return this.comp.compRender();
    }
}
