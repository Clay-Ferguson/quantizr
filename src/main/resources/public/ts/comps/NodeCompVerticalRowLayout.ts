import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Comp } from "../widget/base/Comp";
import { ReactNode } from "react";
import { NodeCompRow } from "./NodeCompRow";
import { Div } from "../widget/Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompVerticalRowLayout extends Comp {

    comp: Comp = null;

    constructor(public node: J.NodeInfo, public newData: boolean, public level: number, public allowNodeMove: boolean) {
        super();
        this.comp = this.build();
    }

    build = (): Comp => {
        let node = this.node;
        let layoutClass = "node-table-row";
        
        if (S.meta64.userPreferences.editMode) {
            layoutClass += " editing-border";
        }
        else {
            layoutClass += " non-editing-border"
        }

        let childCount: number = node.children.length;
        let rowCount: number = 0;
        let comps: Comp[] = [];
        let countToDisplay = 0;
        
        //we have to make a pass over children before main loop below, because we need the countToDisplay
        //to ber correct before the second loop stats.
        for (let i = 0; i < node.children.length; i++) {
            let n: J.NodeInfo = node.children[i];
            if (!S.edit.nodesToMoveSet[n.id]) {
                countToDisplay++;
            }
        }

        for (let i = 0; i < node.children.length; i++) {
            let n: J.NodeInfo = node.children[i];
            if (!S.edit.nodesToMoveSet[n.id]) {
                S.render.updateHighlightNode(n);

                if (this.newData) {
                    S.meta64.initNode(n, true);

                    if (this.debug) {
                        console.log(" RENDER ROW[" + i + "]: node.id=" + n.id);
                    }
                }

                let row: Comp = new NodeCompRow(n, i, childCount, rowCount + 1, this.level, layoutClass, this.allowNodeMove);

                if (rowCount == 0 && S.meta64.userPreferences.editMode) {
                    comps.push(S.render.createBetweenNodeButtonBar(n, true, false));

                    //since the button bar is a float-right, we need a clearfix after it to be sure it consumes vertical space
                    comps.push(new Div(null, { className: "clearfix" }));
                }
                comps.push(row);
                S.render.lastOwner = node.owner;
                //console.log("lastOwner (root)=" + node.owner);
                rowCount++;

                if (S.meta64.userPreferences.editMode) {
                    comps.push(S.render.createBetweenNodeButtonBar(n, false, rowCount == countToDisplay));

                    //since the button bar is a float-right, we need a clearfix after it to be sure it consumes vertical space
                    comps.push(new Div(null, { className: "clearfix" }));
                }

                if (n.children) {
                    comps.push(S.render.renderChildren(n, this.newData, this.level + 1, this.allowNodeMove));
                }
            }
        }
        return new Div(null, null, comps);
    }

    compRender = () : ReactNode => {
        /* Delegate rendering to comp */
        return this.comp.compRender();
    }
}
