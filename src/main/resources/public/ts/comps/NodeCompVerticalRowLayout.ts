import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { EditNodeDlg } from "../dlg/EditNodeDlg";
import { DialogMode } from "../enums/DialogMode";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { Button } from "../widget/Button";
import { CollapsiblePanel } from "../widget/CollapsiblePanel";
import { Div } from "../widget/Div";
import { NodeCompRow } from "./NodeCompRow";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompVerticalRowLayout extends Div {

    constructor(public node: J.NodeInfo, public level: number, public allowNodeMove: boolean, private allowHeaders: boolean) {
        super();
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let childCount: number = this.node.children.length;
        let comps: Comp[] = [];
        let collapsedComps: Object[] = [];
        let allowInsert = S.edit.isInsertAllowed(this.node, state);
        let rowCount: number = 0;
        let lastNode: J.NodeInfo = null;

        // search for all these old-school ways of iterating a list and make them modern! (todo-0)
        for (let i = 0; i < this.node.children.length; i++) {
            let n: J.NodeInfo = this.node.children[i];
            if (n) {
                if (!(state.nodesToMove && state.nodesToMove.find(id => id === n.id))) {

                    // if (n) {
                    //     console.log("RENDER ROW[" + i + "]: node.id=" + n.id + " targetNodeId=" + S.quanta.newNodeTargetId);
                    // }

                    if (state.editNode && state.editNodeOnTab === C.TAB_MAIN && S.quanta.newNodeTargetId === n.id && S.quanta.newNodeTargetOffset === 0) {
                        comps.push(EditNodeDlg.embedInstance || new EditNodeDlg(state.editNode, state.editEncrypt, state.editShowJumpButton, state, DialogMode.EMBED));
                    }

                    if (state.editNode && state.editNodeOnTab === C.TAB_MAIN && n.id === state.editNode.id) {
                        comps.push(EditNodeDlg.embedInstance || new EditNodeDlg(state.editNode, state.editEncrypt, state.editShowJumpButton, state, DialogMode.EMBED));
                    }
                    else {
                        let childrenImgSizes = S.props.getNodePropVal(J.NodeProp.CHILDREN_IMG_SIZES, this.node);
                        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(n.type);

                        // special case where we aren't in edit mode, and we run across a markdown type with blank content, then don't render it.
                        if (typeHandler && typeHandler.getTypeName() === J.NodeType.NONE && !n.content && !state.userPreferences.editMode && !S.props.hasBinary(n)) {
                        }
                        else {
                            lastNode = n;
                            let row: Comp = null;
                            // NOTE: This collapsesComps type thing is intentionally not done on the NodeCompTableRowLayout layout type
                            // because if the user wants their Account root laid out in a grid just let them do that and show everything
                            // without doing any collapsedComps.
                            if (typeHandler && typeHandler.isSpecialAccountNode()) {
                                row = new NodeCompRow(n, typeHandler, i, childCount, rowCount + 1, this.level, false, false, childrenImgSizes, this.allowHeaders, false, state);

                                // I'm gonna be evil here and do this object without a type.
                                collapsedComps.push({ comp: row, subOrdinal: typeHandler.subOrdinal() });
                            }
                            else {
                                row = new NodeCompRow(n, typeHandler, i, childCount, rowCount + 1, this.level, false, false, childrenImgSizes, this.allowHeaders, true, state);
                                comps.push(row);
                            }
                        }

                        rowCount++;
                        if (n.children) {
                            comps.push(S.render.renderChildren(n, this.level + 1, this.allowNodeMove, state));
                        }
                    }

                    if (state.editNode && state.editNodeOnTab === C.TAB_MAIN && S.quanta.newNodeTargetId === n.id && S.quanta.newNodeTargetOffset === 1) {
                        comps.push(EditNodeDlg.embedInstance || new EditNodeDlg(state.editNode, state.editEncrypt, state.editShowJumpButton, state, DialogMode.EMBED));
                    }
                }
            }
        }

        if (this.allowHeaders && allowInsert && !state.isAnonUser && state.userPreferences.editMode) {
            let attribs = {};
            if (state.userPreferences.editMode) {
                S.render.setNodeDropHandler(attribs, lastNode, false, state);
            }

            if (this.level <= 1) {
                // todo-1: this button should have same enabelement as "new" button, on the page root
                if (!state.editNode) {
                    comps.push(new Div(null, { className: "node-table-row" }, [
                        new Button(null, e => {
                            if (lastNode) {
                                S.edit.insertNode(lastNode.id, "u", 1 /* isFirst ? 0 : 1 */, state);
                            }
                            else {
                                S.edit.newSubNode(null, state.node.id);
                            }
                        }, {
                            iconclass: "fa fa-plus",
                            title: "Insert new node"
                        }, "btn-secondary plusButtonFloatRight")
                    ]));
                }

                if (lastNode) {
                    let userCanPaste = (S.props.isMine(lastNode, state) || state.isAdminUser) && lastNode.id !== state.homeNodeId;
                    if (!!state.nodesToMove && userCanPaste) {
                        comps.push(new Button("Paste Here", S.edit.pasteSelNodes_Inline, { nid: lastNode.id }, "btn-secondary pasteButton marginLeft"));
                    }
                }
            }
        }

        if (collapsedComps.length > 0) {
            // put them in subOrdinal order on the page.
            collapsedComps.sort((a: any, b: any) => a.subOrdinal - b.subOrdinal);

            comps.push(new CollapsiblePanel("Other Account Nodes", "Hide", null, collapsedComps.map((c: any) => c.comp), false, (s: boolean) => {
                state.otherAccountNodesExpanded = s;
            }, state.otherAccountNodesExpanded, "marginAll", "specialAccountNodesPanel"));
        }

        this.setChildren(comps);
    }
}
