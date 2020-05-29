import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Comp } from "../widget/base/Comp";
import { NodeCompRow } from "./NodeCompRow";
import { Div } from "../widget/Div";
import { AppState } from "../AppState";
import { useSelector, useDispatch } from "react-redux";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompVerticalRowLayout extends Div {

    constructor(public node: J.NodeInfo, public level: number, public allowNodeMove: boolean) {
        super();
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let layoutClass = "node-table-row";

        if (state.userPreferences.editMode) {
            layoutClass += " editing-border";
        }
        else {
            layoutClass += " non-editing-border"
        }

        let childCount: number = this.node.children.length;
        let comps: Comp[] = [];
        let countToDisplay = 0;

        //we have to make a pass over children before main loop below, because we need the countToDisplay
        //to ber correct before the second loop stats.
        for (let i = 0; i < this.node.children.length; i++) {
            let n: J.NodeInfo = this.node.children[i];
            if (!(state.nodesToMove && state.nodesToMove.find(id => id == n.id))) {
                countToDisplay++;
            }
        }

        let rowCount: number = 0;
        for (let i = 0; i < this.node.children.length; i++) {
            let n: J.NodeInfo = this.node.children[i];
            if (!(state.nodesToMove && state.nodesToMove.find(id => id == n.id))) {

                if (this.debug && n) {
                    console.log("RENDER ROW[" + i + "]: node.id=" + n.id);
                }

                if (rowCount == 0 && state.userPreferences.editMode && this.level == 1) {
                    comps.push(S.render.createBetweenNodeButtonBar(n, true, false, state));

                    //since the button bar is a float-right, we need a clearfix after it to be sure it consumes vertical space
                    comps.push(new Div(null, { className: "clearfix" }));
                }

                let row: Comp = new NodeCompRow(n, i, childCount, rowCount + 1, this.level, layoutClass, this.allowNodeMove);
                comps.push(row);

                S.render.lastOwner = this.node.owner;
                rowCount++;

                if (n.children) {
                    comps.push(S.render.renderChildren(n, this.level + 1, this.allowNodeMove));
                }

                if (state.userPreferences.editMode && this.level == 1) {
                    comps.push(S.render.createBetweenNodeButtonBar(n, false, rowCount == countToDisplay, state));

                    //since the button bar is a float-right, we need a clearfix after it to be sure it consumes vertical space
                    comps.push(new Div(null, { className: "clearfix" }));
                }
            }
        }
        this.setChildren(comps);
    }
}
