import { getAs } from "../../AppContext";
import { Comp } from "../../comp/base/Comp";
import { Button } from "../../comp/core/Button";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import * as J from "../../JavaIntf";
import { NodeInfo } from "../../JavaIntf";
import { S } from "../../Singletons";
import { NodeCompRow } from "./NodeCompRow";

export class NodeCompTableRowLayout extends Comp {

    constructor(public node: NodeInfo, private tabData: TabBase<any>, public level: number, public layout: string, public allowNodeMove: boolean, private allowHeaders: boolean) {
        super({ className: "nodeGridTable" });
    }

    override preRender(): boolean | null {
        const ast = getAs();
        let curRow = new Div(null, { className: "nodeGridRow" });
        const children: Comp[] = [];
        const childCount: number = this.node.children.length;
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

        const cellWidth = 100 / maxCols;
        const allowInsert = S.props.isWritableByMe(this.node);
        let curCols = 0;
        let lastNode: NodeInfo = null;
        let rowIdx = 0;

        // This boolean helps us keep from putting two back to back vertical spaces which would
        // otherwise be able to happen. let inVerticalSpace = false;

        this.node.children?.forEach(n => {
            if (!n) return;
            const comps: Comp[] = [];

            if (!(ast.cutCopyOp == "cut" && ast.nodesToMove && ast.nodesToMove.find(id => id === n.id))) {
                if (this.debug && n) {
                    console.log("RENDER ROW[" + rowIdx + "]: node.id=" + n.id);
                }
                const type = S.plugin.getType(n.type);

                // special case where we aren't in edit mode, and we run across a markdown type with
                // blank content AND no attachment, then don't even render it.
                if (type?.getTypeName() === J.NodeType.NONE && !n.content && !ast.userPrefs.editMode && !S.props.hasBinary(n)) {
                    // do nothing
                }
                else {
                    lastNode = n;
                    const row: Comp = new NodeCompRow(n, this.tabData, type, rowIdx, childCount, rowCount + 1, this.level, true, this.allowNodeMove, this.allowHeaders, true, null);
                    comps.push(row);
                    rowCount++;
                }

                // if we have any children on the node they will always have been loaded to be
                // displayed so display them This is the linline children
                if (n.children) {
                    comps.push(S.render.renderChildren(n, this.tabData, this.level + 1, this.allowNodeMove));
                }

                const curCol = new Div(null, {
                    className: "nodeGridCell",
                    style: {
                        width: cellWidth + "%",
                        maxWidth: cellWidth + "%"
                    }
                }, comps);

                curRow.addChild(curCol);

                if (++curCols === maxCols) {
                    children.push(curRow);
                    curRow = new Div(null, { className: "tableRow" });
                    curCols = 0;
                }
            }
            rowIdx++;
        });

        // the last row might not have filled up yet but add it still
        if (curCols > 0) {
            children.push(curRow);
        }

        const isMine = S.props.isMine(ast.node);

        /* I'll leave this block here, for future reference, but it's dead code. If editMode is on
        we never do the table layout but show each node as if it were vertical layout instead */
        if (isMine && this.allowHeaders && allowInsert && !ast.isAnonUser && ast.userPrefs.editMode) {
            const attribs = {};
            if (ast.userPrefs.editMode) {
                S.render.setNodeDropHandler(attribs, lastNode);
            }

            if (this.level <= 1) {
                children.push(new Button(null, () => {
                    if (lastNode) {
                        S.edit.insertNode(lastNode.id, 1, ast);
                    } else {
                        S.edit._newSubNode(null, ast.node.id);
                    }
                }, {
                    title: "Insert new node"
                }, "btn-secondary marginLeft marginTop ui-new-node-plus", "fa-plus"));

                const userCanPaste = (S.props.isMine(lastNode) || ast.isAdminUser) && lastNode.id !== ast.userProfile?.userNodeId;
                if (!!ast.nodesToMove && userCanPaste) {
                    children.push(new Button("Paste Here", S.edit._pasteSelNodes_Inline, { [C.NODE_ID_ATTR]: lastNode.id }, "btn-secondary pasteButton marginLeft"));
                }
            }
        }

        if (children.length == 0 && S.props.isMine(ast.node) && ast.node.type == J.NodeType.ACCOUNT) {
            children.push(S.render.newUserAccountTips());
            S.edit.helpNewUserEdit();
        }

        if (this.level > 0) {
            this.attribs.style = { paddingLeft: "" + ((this.level - 1) * 30) + "px" };
        }
        this.children = children;
        return true;
    }
}
