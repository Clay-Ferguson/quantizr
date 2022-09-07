import { useAppState } from "../../AppContext";
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

    constructor(state: AppState, public tabData: TabIntf<any>) {
        super(null, {
            id: S.nav._UID_ROWID_PREFIX + state.node.id
            // WARNING: Leave this tabIndex here. it's required for focsing/scrolling
            // tabIndex: "-1"
        });

        const typeHandler = S.plugin.getTypeHandler(J.NodeType.NONE);

        /* If we're in edit mode allow dragging. Note nodes with subOrdinals can't be dragged */
        if ((!typeHandler || typeHandler.subOrdinal() === -1) && state.userPrefs.editMode && !state.inlineEditId) {
            this.attribs.draggable = "true";
            this.attribs.onDragStart = (evt: any) => this.dragStart(evt, state.node.id);
            this.attribs.onDragEnd = this.dragEnd;
        }
    }

    dragStart = (ev: any, draggingId: string) => {
        /* If mouse is not over type icon during a drag start don't allow dragging. This way the entire ROW is the thing that is
        getting dragged, but we don't accept drag events anywhere on the node, because we specifically don't want to. We intentionally
        have draggableId so make is so that the user can only do a drag by clicking the type icon itself to start the drag. */
        if (S.quanta.draggableId !== draggingId) {
            ev.preventDefault();
            return;
        }
        ev.target.style.borderLeft = "6px dotted green";
        ev.dataTransfer.setData("text", draggingId);
    }

    dragEnd = (ev: any) => {
        ev.target.style.borderLeft = "6px solid transparent";
    }

    preRender(): void {
        const state = useAppState();
        const node = state.node;

        if (!node) {
            this.setChildren(null);
            return;
        }

        if (state.editNode && state.editNodeOnTab === C.TAB_MAIN && node.id === state.editNode.id) {
            this.setChildren([EditNodeDlg.embedInstance || new EditNodeDlg(state.editEncrypt, state.editShowJumpButton, DialogMode.EMBED, null)]);
        }
        else {
            const focusNode = S.nodeUtil.getHighlightedNode(state);
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
            const typeHandler = S.plugin.getTypeHandler(node.type);
            if (state.userPrefs.showMetaData && (typeHandler == null || typeHandler?.getAllowRowHeader())) {
                header = new NodeCompRowHeader(node, true, true, false, false, true, false);
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
                const typeHandler = S.plugin.getTypeHandler(node.boostedNode.type);
                boostComp = new NodeCompRow(node.boostedNode, this.tabData, typeHandler, 0, 0, 0, 0, false, false, true, false, true, true, null, state);
            }

            this.setChildren([
                header,
                !state.inlineEditId ? new NodeCompButtonBar(node, false, 1, null, null) : null,
                new Clearfix(),
                jumpButton,
                new NodeCompContent(node, this.tabData, false, true, null, null, true, false, null),
                boostComp,
                new NodeCompRowFooter(node, false, true),
                new Clearfix()
            ]);
        }
    }
}
