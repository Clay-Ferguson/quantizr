import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Comp } from "../widget/base/Comp";
import { ReactNode } from "react";
import { NodeCompRow } from "./NodeCompRow";
import { Div } from "../widget/Div";
import { AppState } from "../AppState";
import { useSelector, useDispatch } from "react-redux";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompTableRowLayout extends Div {

    constructor(public node: J.NodeInfo, public level: number, public layout: string, public allowNodeMove: boolean) {
        super(null, { className: 'node-grid-table' });
    }

    super_CompRender: any = this.compRender;
    compRender = (): ReactNode => {
        let nodesToMove = useSelector((state: AppState) => state.nodesToMove);
        let node = this.node;
        let curRow = new Div(null, { className: 'node-grid-row' });
        let children: Comp[] = [];
        let layoutClass = "node-grid-item";
        let childCount: number = node.children.length;
        let rowCount: number = 0;
        let maxCols = 2;
        if (this.layout == "c2") {
            maxCols = 2;
        }
        else if (this.layout == "c3") {
            maxCols = 3;
        }
        else if (this.layout == "c4") {
            maxCols = 4;
        }
        let cellWidth = 100 / maxCols;

        let curCols = 0;
        for (let i = 0; i < node.children.length; i++) {
            let comps: Comp[] = [];
            let n: J.NodeInfo = node.children[i];

            if (!(nodesToMove && nodesToMove.find(id => id == n.id))) {
                S.render.updateHighlightNode(n);

                if (this.debug && n) {
                    console.log(" RENDER ROW[" + i + "]: node.id=" + n.id);
                }

                let row: Comp = new NodeCompRow(n, i, childCount, rowCount + 1, this.level, layoutClass, this.allowNodeMove);
                // console.log("row[" + rowCount + "]=" + row);
                comps.push(row);
                rowCount++;

                //console.log("lastOwner (child level " + level + ")=" + n.owner);
                S.render.lastOwner = n.owner;

                if (n.children) {
                    comps.push(S.render.renderChildren(n, this.level + 1, this.allowNodeMove));
                }

                let curCol = new Div(null, {
                    className: 'node-grid-cell',
                    style: {
                        width: cellWidth + '%',
                        maxWidth: cellWidth + '%'
                    }
                }, comps);
                curRow.children.push(curCol);

                if (++curCols == maxCols) {
                    children.push(curRow);
                    curRow = new Div(null, { style: { display: 'table-row' } });
                    curCols = 0;
                }
            }
        }

        //the last row might not have filled up yet but add it still
        if (curCols > 0) {
            children.push(curRow);
        }

        this.setChildren(children);

        return this.super_CompRender();
    }
}
