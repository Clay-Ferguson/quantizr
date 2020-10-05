import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { NodeActionType } from "../enums/NodeActionType";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { Div } from "../widget/Div";
import { IconButton } from "../widget/IconButton";
import { NodeCompRow } from "./NodeCompRow";

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
        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(this.node.type);
        let layoutClass = "node-table-row";

        if (state.userPreferences.editMode) {
            layoutClass += " editing-border";
        }
        else {
            layoutClass += " non-editing-border";
        }

        let childCount: number = this.node.children.length;
        let comps: Comp[] = [];
        let countToDisplay = 0;

        /* we have to make a pass over children before main loop below, because we need the countToDisplay
        to ber correct before the second loop stats. */
        for (let i = 0; i < this.node.children.length; i++) {
            let n: J.NodeInfo = this.node.children[i];
            if (!(state.nodesToMove && state.nodesToMove.find(id => id === n.id))) {
                countToDisplay++;
            }
        }

        let allowInsert = S.edit.isInsertAllowed(this.node, state);

        /* We have this hack (until the privileges are more nuanced, or updated) which verifies if someone is
        inserting under a USER_FEED node we don't allow it unless its' the person who OWNS the USER_FEED, and we have this check
        because right now our design is that USER_FEED nodes are by definition automatically 'public'

        NOTE: Server also enforces this check if it gets by the client.
        */
        if (allowInsert && typeHandler) {
            allowInsert = state.isAdminUser || typeHandler.allowAction(NodeActionType.addChild, this.node, state);
        }

        let rowCount: number = 0;
        let lastNode: J.NodeInfo = null;
        for (let i = 0; i < this.node.children.length; i++) {
            let n: J.NodeInfo = this.node.children[i];
            if (!(state.nodesToMove && state.nodesToMove.find(id => id === n.id))) {

                if (this.debug && n) {
                    console.log("RENDER ROW[" + i + "]: node.id=" + n.id);
                }

                let userCanPaste = S.props.isMine(n, state) || state.isAdminUser || n.id === state.homeNodeId;
                if (allowInsert && !state.isAnonUser && state.userPreferences.editMode && !!state.nodesToMove && userCanPaste && this.level === 1 && rowCount === 0) {
                    comps.push(S.render.createBetweenNodeButtonBar(n, true, false, state));
                    // since the button bar is a float-right, we need a clearfix after it to be sure it consumes vertical space
                    comps.push(new Div(null, { className: "clearfix" }));
                }

                let childrenImgSizes = S.props.getNodePropVal(J.NodeProp.CHILDREN_IMG_SIZES, this.node);

                let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(n.type);

                // special case where we aren't in edit mode, and we run across a markdown type with blank content, then don't render it.
                if (typeHandler && typeHandler.getTypeName() === J.NodeType.NONE && !n.content && !state.userPreferences.editMode && !S.props.hasBinary(n)) {
                }
                else {
                    lastNode = n;
                    let row: Comp = new NodeCompRow(n, i, childCount, rowCount + 1, this.level, layoutClass, this.allowNodeMove, childrenImgSizes, state);
                    comps.push(row);
                }

                S.render.lastOwner = this.node.owner;
                rowCount++;

                if (n.children) {
                    comps.push(S.render.renderChildren(n, this.level + 1, this.allowNodeMove));
                }

                if (allowInsert && !state.isAnonUser && state.userPreferences.editMode && !!state.nodesToMove && userCanPaste && this.level === 1) {
                    comps.push(S.render.createBetweenNodeButtonBar(n, false, rowCount === countToDisplay, state));
                    // since the button bar is a float-right, we need a clearfix after it to be sure it consumes vertical space
                    comps.push(new Div(null, { className: "clearfix" }));
                }
            }
        }

        if (allowInsert && !state.isAnonUser && state.userPreferences.editMode) {
            let attribs = {};
            if (state.userPreferences.editMode) {
                S.render.setNodeDropHandler(attribs, lastNode, false, state);
            }

            let div = new Div(null, attribs, [
                new IconButton("fa-plus", null, {
                    onClick: e => {
                        S.edit.insertNode(lastNode.id, "u", 1 /* isFirst ? 0 : 1 */, state);
                    },
                    title: "Insert new node here"
                }, "btn-sm btn-secondary marginTop marginLeft")
            ]);

            comps.push(div);
        }

        this.setChildren(comps);
    }
}
