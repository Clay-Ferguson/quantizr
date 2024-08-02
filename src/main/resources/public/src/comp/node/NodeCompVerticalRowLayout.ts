import { getAs } from "../../AppContext";
import { Comp } from "../../comp/base/Comp";
import { Button } from "../../comp/core/Button";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { EditNodeDlg } from "../../dlg/EditNodeDlg";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { NodeInfo } from "../../JavaIntf";
import { S } from "../../Singletons";
import { NodeCompRow } from "./NodeCompRow";

export class NodeCompVerticalRowLayout extends Div {
    static showSpecialNodes = true;

    constructor(public node: NodeInfo, private tabData: TabIntf<any>, public level: number, public allowNodeMove: boolean, private allowHeaders: boolean) {
        super();
    }

    override preRender = (): boolean => {
        const ast = getAs();
        const childCount: number = this.node.children.length;
        const comps: Comp[] = [];
        const allowInsert = S.props.isWritableByMe(this.node);
        let rowCount: number = 0;
        let lastNode: NodeInfo = null;
        let rowIdx = 0;

        // This boolean helps us keep from putting two back to back vertical spaces which would otherwise be able to happen.
        // let inVerticalSpace = false;
        const isMine = S.props.isMine(ast.node);

        this.node.children?.forEach(n => {
            if (!n) return;
            if (!(ast.cutCopyOp === "cut" && ast.nodesToMove?.find(id => id === n.id))) {
                // console.log("RENDER ROW[" + rowIdx + "]: node.id=" + n.id + " targetNodeId=" + S.quanta.newNodeTargetId);
                const type = S.plugin.getType(n.type);

                // special case where we aren't in edit mode, and we run across a markdown type with
                // blank content, then don't render it.
                if (type && type.getTypeName() === J.NodeType.NONE && !n.content && !ast.userPrefs.editMode && !S.props.hasBinary(n)) {
                    // do nothing
                }
                else {
                    lastNode = n;
                    let row: Comp = null;

                    // experimenting: Still need this?
                    // if (n.children && !inVerticalSpace) {
                    //     comps.push(new Div(null, { className: "verticalSpace" }));
                    // }

                    if (!type?.isSpecialAccountNode() || ast.isAdminUser) {
                        row = new NodeCompRow(n, this.tabData, type, rowIdx, childCount, rowCount + 1, this.level, false, true, this.allowHeaders, isMine, null);
                        rowCount++;
                        comps.push(row);
                    }
                    // inVerticalSpace = false;
                }

                // if we have any children on the node they will always have been loaded to be
                // displayed so display them This is the linline children
                if (n.children) {
                    comps.push(S.render.renderChildren(n, this.tabData, this.level + 1, this.allowNodeMove));

                    // experimenting: Still need this?
                    // comps.push(new Div(null, { className: "verticalSpace" }));
                    // inVerticalSpace = true;
                }
            }
            rowIdx++;

            if (this.level > 1 && rowIdx == 100) {
                const style = {
                    marginLeft: "" + (this.level * 30) + "px",
                    marginBottom: "12px"
                };
                comps.push(new Div("truncated...", { style }));
            }
        });

        if (isMine && this.allowHeaders && allowInsert && !ast.isAnonUser && ast.userPrefs.editMode) {
            const attribs = {};
            if (ast.userPrefs.editMode) {
                S.render.setNodeDropHandler(attribs, lastNode);
            }

            if (this.level <= 1) {
                let insertButton: Button = null;
                // 2: this button should have same enablement as "new" button, on the page root
                // Note: this is the very last "+" button at the bottom, to insert below last child
                comps.push(new Div(null, { className: (ast.userPrefs.editMode ? "nodeTableRowEdit" : "nodeTableRow") }, [
                    insertButton = new Button(null, () => {
                        if (lastNode) {
                            S.edit.insertNode(lastNode.id, 1, ast);
                        }
                        else {
                            S.edit.newSubNode(null, ast.node.id);
                        }
                    }, {
                        title: "Insert new node"
                    }, "btn-secondary plusButtonFloatRight ui-new-node-plus", "fa-plus")
                ]));

                S.domUtil.setDropHandler(insertButton.attribs, (evt: DragEvent) => {
                    for (const item of evt.dataTransfer.items) {
                        // console.log("DROP(e) kind=" + item.kind + " type=" + item.type);

                        if (item.kind === "file") {
                            EditNodeDlg.pendingUploadFile = item.getAsFile();
                            if (lastNode) {
                                S.edit.insertNode(lastNode.id, 1, ast);
                            }
                            else {
                                S.edit.newSubNode(null, ast.node.id);
                            }
                            return;
                        }
                    }
                });

                if (lastNode) {
                    const userCanPaste = (S.props.isMine(lastNode) || ast.isAdminUser) && lastNode.id !== ast.userProfile?.userNodeId;
                    if (!!ast.nodesToMove && userCanPaste) {
                        comps.push(new Button("Paste Here", S.edit.pasteSelNodes_Inline, { [C.NODE_ID_ATTR]: lastNode.id }, "btn-secondary pasteButton marginLeft"));
                    }
                }
            }
        }

        if (comps.length == 0 && S.props.isMine(ast.node) && ast.node.type == J.NodeType.ACCOUNT) {
            comps.push(S.render.newUserAccountTips());
            S.edit.helpNewUserEdit();
        }

        this.children = comps;
        return true;
    }
}
