import { useAppState } from "../../AppContext";
import { Comp } from "../../comp/base/Comp";
import { Button } from "../../comp/core/Button";
import { CollapsiblePanel } from "../../comp/core/CollapsiblePanel";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { DialogMode } from "../../DialogBase";
import { EditNodeDlg } from "../../dlg/EditNodeDlg";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { NodeCompRow } from "./NodeCompRow";

export class NodeCompVerticalRowLayout extends Div {
    static showSpecialNodes = true;

    constructor(public node: J.NodeInfo, private tabData: TabIntf<any>, public level: number, public allowNodeMove: boolean, private allowHeaders: boolean) {
        super();
    }

    preRender(): void {
        const state = useAppState();
        const childCount: number = this.node.children.length;
        const comps: Comp[] = [];
        const collapsedComps: Object[] = [];
        const allowInsert = S.edit.isInsertAllowed(this.node, state);
        let rowCount: number = 0;
        let lastNode: J.NodeInfo = null;
        let rowIdx = 0;

        // This boolean helps us keep from putting two back to back vertical spaces which would otherwise be able to happen.
        let inVerticalSpace = false;
        const isMine = S.props.isMine(state.node, state);

        this.node.children?.forEach((n: J.NodeInfo) => {
            if (!n) return;
            if (!(state.nodesToMove?.find(id => id === n.id))) {
                // console.log("RENDER ROW[" + rowIdx + "]: node.id=" + n.id + " targetNodeId=" + S.quanta.newNodeTargetId);

                let boostComp: NodeCompRow = null;
                if (n.boostedNode) {
                    // console.log("BOOST TARGET: " + S.util.prettyPrint(n.boostedNode));
                    const typeHandler = S.plugin.getTypeHandler(n.boostedNode.type);
                    boostComp = new NodeCompRow(n.boostedNode, this.tabData, typeHandler, 0, 0, 0, this.level, false, false, this.allowHeaders, false, true, true, null, state);
                }

                if (state.editNode && state.editNodeOnTab === C.TAB_MAIN && S.quanta.newNodeTargetId === n.id && S.quanta.newNodeTargetOffset === 0) {
                    comps.push(EditNodeDlg.embedInstance || new EditNodeDlg(state.editEncrypt, state.editShowJumpButton, DialogMode.EMBED, null));
                }

                if (state.editNode && state.editNodeOnTab === C.TAB_MAIN && n.id === state.editNode.id) {
                    comps.push(EditNodeDlg.embedInstance || new EditNodeDlg(state.editEncrypt, state.editShowJumpButton, DialogMode.EMBED, null));
                }
                else {
                    const typeHandler = S.plugin.getTypeHandler(n.type);

                    // special case where we aren't in edit mode, and we run across a markdown type with blank content, then don't render it.
                    if (typeHandler && typeHandler.getTypeName() === J.NodeType.NONE && !n.content && !state.userPrefs.editMode && !S.props.hasBinary(n)) {
                    }
                    else {
                        lastNode = n;
                        let row: Comp = null;
                        if (n.children && !inVerticalSpace) {
                            comps.push(new Div(null, { className: "vertical-space" }));
                        }

                        /* NOTE: This collapsesComps type thing is intentionally not done on the NodeCompTableRowLayout layout type
                         because if the user wants their Account root laid out in a grid just let them do that and show everything
                         without doing any collapsedComps. */
                        if (typeHandler && typeHandler.isSpecialAccountNode()) {
                            if (NodeCompVerticalRowLayout.showSpecialNodes) {
                                row = new NodeCompRow(n, this.tabData, typeHandler, rowIdx, childCount, rowCount + 1, this.level, false, true, this.allowHeaders, false, true, false, null, state);

                                // I'm gonna be evil here and do this object without a type.
                                collapsedComps.push({ comp: row, subOrdinal: typeHandler.subOrdinal() });
                            }
                        }
                        else {
                            row = new NodeCompRow(n, this.tabData, typeHandler, rowIdx, childCount, rowCount + 1, this.level, false, true, this.allowHeaders, isMine, true, false, boostComp, state);
                            comps.push(row);
                        }
                        inVerticalSpace = false;
                    }

                    rowCount++;
                    // if we have any children on the node they will always have been loaded to be displayed so display them
                    // This is the linline children
                    if (n.children) {
                        comps.push(S.render.renderChildren(n, this.tabData, this.level + 1, this.allowNodeMove, state));
                        comps.push(new Div(null, { className: "vertical-space" }));
                        inVerticalSpace = true;
                    }
                }

                if (state.editNode && state.editNodeOnTab === C.TAB_MAIN && S.quanta.newNodeTargetId === n.id && S.quanta.newNodeTargetOffset === 1) {
                    comps.push(EditNodeDlg.embedInstance || new EditNodeDlg(state.editEncrypt, state.editShowJumpButton, DialogMode.EMBED, null));
                }
            }
            rowIdx++;
        });

        if (isMine && this.allowHeaders && allowInsert && !state.isAnonUser && state.userPrefs.editMode) {
            const attribs = {};
            if (state.userPrefs.editMode) {
                S.render.setNodeDropHandler(attribs, lastNode, false, state);
            }

            if (this.level <= 1) {
                let insertButton: Button = null;
                // todo-1: this button should have same enablement as "new" button, on the page root
                // Note: this is the very last "+" button at the bottom, to insert below last child
                comps.push(new Div(null, { className: (state.userPrefs.editMode ? "node-table-row-compact" : "node-table-row") }, [
                    insertButton = new Button(null, () => {
                        if (lastNode) {
                            S.edit.insertNode(lastNode.id, J.NodeType.NONE, 1 /* isFirst ? 0 : 1 */, state);
                        }
                        else {
                            S.edit.newSubNode(null, state.node.id);
                        }
                    }, {
                        title: "Insert new node"
                    }, "btn-secondary plusButtonFloatRight", "fa-plus")
                ]));

                // todo-1: document this in tips and tricks
                S.domUtil.setDropHandler(insertButton.attribs, true, (evt: DragEvent) => {
                    for (const item of evt.dataTransfer.items) {
                        if (item.kind === "file") {
                            EditNodeDlg.pendingUploadFile = item.getAsFile();
                            if (lastNode) {
                                S.edit.insertNode(lastNode.id, J.NodeType.NONE, 1 /* isFirst ? 0 : 1 */, state);
                            }
                            else {
                                S.edit.newSubNode(null, state.node.id);
                            }
                            return;
                        }
                    }
                });

                if (lastNode) {
                    const userCanPaste = (S.props.isMine(lastNode, state) || state.isAdminUser) && lastNode.id !== state.homeNodeId;
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
            }, state.otherAccountNodesExpanded, "marginAll", "specialAccountNodesPanel", ""));
        }

        this.setChildren(comps);
    }
}
