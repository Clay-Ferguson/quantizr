import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { EditNodeDlg } from "../dlg/EditNodeDlg";
import { DialogMode } from "../enums/DialogMode";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Clearfix } from "../widget/Clearfix";
import { Div } from "../widget/Div";
import { IconButton } from "../widget/IconButton";
import { NodeCompButtonBar } from "./NodeCompButtonBar";
import { NodeCompContent } from "./NodeCompContent";
import { NodeCompRowFooter } from "./NodeCompRowFooter";
import { NodeCompRowHeader } from "./NodeCompRowHeader";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompMainNode extends Div {

    constructor(private state: AppState, public imgSizeOverride: string) {
        super(null, {
            id: S.nav._UID_ROWID_PREFIX + state.node.id
            // WARNING: Leave this tabIndex here. it's required for focsing/scrolling
            // tabIndex: "-1"
        });

        let typeHandler = S.plugin.getTypeHandler(J.NodeType.NONE);

        /* If we're in edit mode allow dragging. Note nodes with subOrdinals can't be dragged */
        if ((typeHandler == null || typeHandler.subOrdinal() === -1) && state.userPreferences.editMode && !state.inlineEditId) {
            this.attribs.draggable = "true";
            this.attribs.onDragStart = this.dragStart;
            this.attribs.onDragEnd = this.dragEnd;
        }
    }

    dragStart = (ev): void => {
        // let state: AppState = useSelector((state: AppState) => state);
        /* If mouse is not over type icon during a drag start don't allow dragging. This way the entire ROW is the thing that is
        getting dragged, but we don't accept drag events anywhere on the node, because we specifically don't want to. We intentionally
        have draggableId so make is so that the user can only do a drag by clicking the type icon itself to start the drag. */
        if (S.quanta.draggableId !== this.state.node.id) {
            ev.preventDefault();
            return;
        }
        ev.target.style.borderLeft = "6px dotted green";
        ev.dataTransfer.setData("text", ev.target.id);
    }

    dragEnd = (ev): void => {
        ev.target.style.borderLeft = "6px solid transparent";
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let node = state.node;

        if (!node) {
            this.setChildren(null);
            return;
        }

        if (state.editNode && state.editNodeOnTab === C.TAB_MAIN && node.id === state.editNode.id) {
            this.setChildren([EditNodeDlg.embedInstance || new EditNodeDlg(state.editNode, state.editEncrypt, state.editShowJumpButton, state, DialogMode.EMBED)]);
        }
        else {
            let focusNode: J.NodeInfo = S.quanta.getHighlightedNode(state);
            let selected: boolean = (focusNode && focusNode.id === node.id);
            this.attribs.className = "mainNodeContentStyle " + (selected ? "active-row-main" : "inactive-row-main");

            if (S.render.enableRowFading && S.render.fadeInId === node.id && S.render.allowFadeInId) {
                S.render.fadeInId = null;
                S.render.allowFadeInId = false;
                this.attribs.className += " fadeInRowBkgClz";
                S.quanta.fadeStartTime = new Date().getTime();
            }

            this.attribs.nid = node.id;
            this.attribs.onClick = S.nav.clickNodeRow;

            let header: CompIntf = null;
            let jumpButton: CompIntf = null;
            if (state.userPreferences.showMetaData) {
                header = new NodeCompRowHeader(node, true, true, false, false);
            }
            else {
                const targetId = S.props.getNodePropVal(J.NodeProp.TARGET_ID, node);
                if (targetId) {
                    jumpButton = new IconButton("fa-arrow-right", null, {
                        onClick: () => S.view.jumpToId(targetId),
                        title: "Jump to the Node"
                    }, "float-end");
                }
            }

            this.setChildren([
                header,
                !state.inlineEditId ? new NodeCompButtonBar(node, false, 1, null, null) : null,
                new Clearfix("bbcf_" + node.id),
                jumpButton,
                new NodeCompContent(node, false, true, null, null, this.imgSizeOverride, true),
                new NodeCompRowFooter(node, false)
            ]);
        }
    }
}
