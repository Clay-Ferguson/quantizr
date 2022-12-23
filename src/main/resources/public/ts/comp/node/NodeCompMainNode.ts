import { getAppState, useAppState } from "../../AppContext";
import { AppState } from "../../AppState";
import { CompIntf } from "../../comp/base/CompIntf";
import { Clearfix } from "../../comp/core/Clearfix";
import { Div } from "../../comp/core/Div";
import { IconButton } from "../../comp/core/IconButton";
import { Constants as C } from "../../Constants";
import { DialogMode } from "../../DialogBase";
import { EditNodeDlg } from "../../dlg/EditNodeDlg";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { NodeCompButtonBar } from "./NodeCompButtonBar";
import { NodeCompContent } from "./NodeCompContent";
import { NodeCompRow } from "./NodeCompRow";
import { NodeCompRowFooter } from "./NodeCompRowFooter";
import { NodeCompRowHeader } from "./NodeCompRowHeader";

export class NodeCompMainNode extends Div {

    constructor(ast: AppState, public tabData: TabIntf<any>) {
        super(null, {
            id: S.nav._UID_ROWID_PREFIX + ast.node.id
            // WARNING: Leave this tabIndex here. it's required for focsing/scrolling
            // tabIndex: "-1"
        });

        const type = S.plugin.getType(J.NodeType.NONE);

        /* If we're in edit mode allow dragging. Note nodes with subOrdinals can't be dragged */
        if ((!type || type.subOrdinal() === -1) && ast.userPrefs.editMode && !ast.inlineEditId) {
            this.attribs.draggable = "true";
            this.attribs.onDragStart = (evt: any) => this.dragStart(evt, ast.node.id);
            this.attribs.onDragEnd = this.dragEnd;
        }
    }

    dragStart = (ev: any, draggingId: string) => {
        const ast = getAppState();
        if (ast.editNode) {
            return;
        }
        ev.currentTarget.classList.add("dragBorderSource");
        S.quanta.dragElm = ev.target;
        S.quanta.draggingId = draggingId;
        ev.dataTransfer.setData(C.DND_TYPE_NODEID, draggingId);
        ev.dataTransfer.setDragImage(S.quanta.dragImg, 0, 0);
    }

    dragEnd = (ev: any) => {
        ev.currentTarget.classList.remove("dragBorderSource");
    }

    preRender(): void {
        const ast = useAppState();
        const node = ast.node;

        if (!node) {
            this.setChildren(null);
            return;
        }

        if (ast.editNode && ast.editNodeOnTab === C.TAB_MAIN && node.id === ast.editNode.id) {
            this.setChildren([EditNodeDlg.embedInstance || new EditNodeDlg(ast.editEncrypt, ast.editShowJumpButton, DialogMode.EMBED, null)]);
        }
        else {
            const focusNode = S.nodeUtil.getHighlightedNode(ast);
            const selected: boolean = (focusNode && focusNode.id === node.id);
            this.attribs.className = selected ? "active-row-main" : "inactive-row-main";

            if (S.render.enableRowFading && S.render.fadeInId === node.id && S.render.allowFadeInId) {
                S.render.fadeInId = null;
                S.render.allowFadeInId = false;
                this.attribs.className += " fadeInRowBkgClz";
                S.quanta.fadeStartTime = new Date().getTime();
            }

            this.attribs.nid = node.id;
            this.attribs.onClick = S.nav.clickTreeNode;

            let header: CompIntf = null;
            let jumpButton: CompIntf = null;
            const type = S.plugin.getType(node.type);

            let allowHeader: boolean = false;
            // special case, if node is owned by admin and we're not admin, never show header
            if (!C.ALLOW_ADMIN_NODE_HEADERS && node.owner === J.PrincipalName.ADMIN && ast.userName !== J.PrincipalName.ADMIN) {
                // leave allowHeader false
            }
            else {
                allowHeader = ast.userPrefs.showMetaData && (type == null || type?.getAllowRowHeader())
            }

            if (allowHeader) {
                const allowDelete = this.tabData.id !== C.TAB_DOCUMENT;
                const showJumpButton = this.tabData.id !== C.TAB_MAIN;
                header = new NodeCompRowHeader(node, true, true, false, showJumpButton, true, false, allowDelete);
            }
            else {
                const targetId = S.props.getPropStr(J.NodeProp.TARGET_ID, node);
                if (targetId) {
                    jumpButton = new IconButton("fa-arrow-right", null, {
                        onClick: () => S.view.jumpToId(targetId),
                        title: "Jump to the Node"
                    }, "btn-secondary float-end");
                }
            }

            let boostComp: NodeCompRow = null;
            if (node.boostedNode) {
                // console.log("BOOST TARGET: " + S.util.prettyPrint(n.boostedNode));
                const type = S.plugin.getType(node.boostedNode.type);
                boostComp = new NodeCompRow(node.boostedNode, this.tabData, type, 0, 0, 0, 0, false, false, true, false, true, null, ast);
            }

            // if editMode is on, an this isn't the page root node
            if (ast.userPrefs.editMode) {
                S.render.setNodeDropHandler(this.attribs, node);
            }

            this.setChildren([
                header,
                !ast.inlineEditId ? new NodeCompButtonBar(node, false, null, null) : null,
                new Clearfix(),
                jumpButton,
                new NodeCompContent(node, this.tabData, false, true, null, null, true, false, null),
                boostComp,
                new NodeCompRowFooter(node),
                new Clearfix()
            ]);
        }
    }
}
