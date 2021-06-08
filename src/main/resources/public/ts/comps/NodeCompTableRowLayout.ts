import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { Button } from "../widget/Button";
import { Div } from "../widget/Div";
import { IconButton } from "../widget/IconButton";
import { NodeCompRow } from "./NodeCompRow";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompTableRowLayout extends Div {

    constructor(public node: J.NodeInfo, public level: number, public layout: string, public allowNodeMove: boolean, private allowHeaders: boolean) {
        super(null, { className: "node-grid-table" });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let nodesToMove = state.nodesToMove;
        let curRow = new Div(null, { className: "node-grid-row" });
        let children: Comp[] = [];
        let childCount: number = this.node.children.length;
        let rowCount: number = 0;
        let maxCols = 2;

        if (this.layout === "c2") {
            maxCols = 2;
        }
        else if (this.layout === "c3") {
            maxCols = 3;
        }
        else if (this.layout === "c4") {
            maxCols = 4;
        }
        else if (this.layout === "c5") {
            maxCols = 5;
        }
        else if (this.layout === "c6") {
            maxCols = 6;
        }
        let cellWidth = 100 / maxCols;
        let allowInsert = S.edit.isInsertAllowed(this.node, state);
        let curCols = 0;
        let lastNode: J.NodeInfo = null;

        for (let i = 0; i < this.node.children.length; i++) {
            let comps: Comp[] = [];
            let n: J.NodeInfo = this.node.children[i];

            if (!(nodesToMove && nodesToMove.find(id => id === n.id))) {

                if (this.debug && n) {
                    console.log("RENDER ROW[" + i + "]: node.id=" + n.id);
                }

                let childrenImgSizes = S.props.getNodePropVal(J.NodeProp.CHILDREN_IMG_SIZES, this.node);
                let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(n.type);

                // special case where we aren't in edit mode, and we run across a markdown type with blank content AND no attachment, then don't even render it.
                if (typeHandler && typeHandler.getTypeName() === J.NodeType.NONE && !n.content && !state.userPreferences.editMode && !S.props.hasBinary(n)) {
                }
                else {
                    lastNode = n;
                    let row: Comp = new NodeCompRow(n, i, childCount, rowCount + 1, this.level, true, this.allowNodeMove, childrenImgSizes, this.allowHeaders, state);
                    comps.push(row);
                }

                rowCount++;
                if (n.children) {
                    comps.push(S.render.renderChildren(n, this.level + 1, this.allowNodeMove, state));
                }

                let curCol = new Div(null, {
                    className: "node-grid-cell",
                    style: {
                        width: cellWidth + "%",
                        maxWidth: cellWidth + "%"
                    }
                }, comps);
                curRow.getChildren().push(curCol);

                if (++curCols === maxCols) {
                    children.push(curRow);
                    curRow = new Div(null, { className: "tableRow" });
                    curCols = 0;
                }
            }
        }

        // the last row might not have filled up yet but add it still
        if (curCols > 0) {
            children.push(curRow);
        }

        if (this.allowHeaders && allowInsert && !state.isAnonUser && state.userPreferences.editMode) {
            let attribs = {};
            if (state.userPreferences.editMode) {
                S.render.setNodeDropHandler(attribs, lastNode, false, state);
            }

            if (this.level <= 1) {
                // todo-1: this button should have same enablement as "new" button, on the page root
                let btn = new IconButton("fa-plus", null, {
                    onClick: e => {
                        if (lastNode) {
                            S.edit.insertNode(lastNode.id, "u", 1 /* isFirst ? 0 : 1 */, state);
                        } else {
                            S.edit.newSubNode(null, state.node.id);
                        }
                    },
                    title: "Insert new node"
                }, "btn-secondary marginLeft marginTop");
                children.push(btn);

                let userCanPaste = (S.props.isMine(lastNode, state) || state.isAdminUser) && lastNode.id !== state.homeNodeId;
                if (!!state.nodesToMove && userCanPaste) {
                    children.push(new Button("Paste Here", S.edit.pasteSelNodes_Inline, { nid: lastNode.id }, "btn-secondary pasteButton"));
                }
            }
        }
        this.setChildren(children);
    }
}
