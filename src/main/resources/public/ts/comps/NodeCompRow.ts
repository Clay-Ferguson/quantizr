import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { NodeActionType } from "../enums/NodeActionType";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
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
export class NodeCompRow extends Div {

    /* we have this flag so we can turn off buttons to troubleshoot performance. */
    static showButtonBar: boolean = true;

    constructor(public node: J.NodeInfo, public index: number, public count: number, public rowCount: number, public level: number,
        public isTableCell: boolean, public allowNodeMove: boolean, public imgSizeOverride: string, private allowHeaders: boolean,
        appState: AppState) {
        super(null, {
            id: S.nav._UID_ROWID_PREFIX + node.id,
            // WARNING: Leave this tabIndex here. it's required for focsing/scrolling
            tabIndex: "-1"
        });

        /* If we're in edit mode allow dragging */
        if (appState.userPreferences.editMode && !appState.inlineEditId) {
            this.attribs.draggable = "true";
            this.attribs.onDragStart = this.dragStart;
            this.attribs.onDragEnd = this.dragEnd;
        }
    }

    dragStart = (ev): void => {
        /* If mouse is not over type icon during a drag start don't allow dragging. This way the entire ROW is the thing that is
        getting dragged, but we don't accept drag events anywhere on the node, because we specifically don't want to. We intentionally
        have draggableId so make is so that the user can only do a drag by clicking the type icon itself to start the drag. */
        if (S.meta64.draggableId !== this.node.id) {
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
        let node = this.node;
        let id: string = node.id;

        if (this.allowHeaders) {
            this.attribs.nid = id;
            this.attribs.onClick = S.nav.clickNodeRow;
        }

        let insertInlineButton = null;
        if (this.allowHeaders && state.userPreferences.editMode) {
            let insertAllowed = true;

            /* if we are at level one that means state.node is the parent of 'this.node' so that's what determines if we
            can insert or not */
            if (this.level === 1) {
                let parentTypeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(state.node.type);
                if (parentTypeHandler) {
                    insertAllowed = state.isAdminUser || parentTypeHandler.allowAction(NodeActionType.insert, state.node, state);
                }
            }

            let isPageRootNode = state.node && this.node.id === state.node.id;

            if (!state.editNode && !isPageRootNode && this.level === 1 && insertAllowed && S.edit.isInsertAllowed(node, state)) {

                // todo-1: this button should have same enabelement as "new" button, on the page root ???
                insertInlineButton = new Div(null, { className: "marginLeft" }, [
                    new IconButton("fa-plus", null, {
                        onClick: (e) => {
                            S.edit.insertNode(node.id, "u", 0 /* isFirst ? 0 : 1 */, state);
                        },
                        title: "Insert new node" + (this.isTableCell ? " (above this one)" : "")
                    }, "btn-secondary " + (this.isTableCell ? "" : "plusButtonFloatRight"))
                ]);
            }
        }

        let buttonBar: Comp = null;
        if (this.allowHeaders && NodeCompRow.showButtonBar && !state.inlineEditId) {
            let extraClass = state.userPreferences.showMetaData && state.userPreferences.editMode ? "nodeCompButtonBar" : null;
            buttonBar = new NodeCompButtonBar(node, this.allowNodeMove, this.level, this.isTableCell ? [insertInlineButton] : null, extraClass);
        }

        let layoutClass = this.isTableCell ? "node-grid-item" : "node-table-row";
        const layout = S.props.getNodePropVal(J.NodeProp.LAYOUT, this.node);

        // if this node has children as columnar layout, and is rendering as the root node of a page or a node that is expanded inline,
        // that means there will be a grid below this node so we don't show the border (bottom divider line) because it's more attractive not to.
        if (this.isTableCell) {
        }
        else if (layout && layout.indexOf("c") === 0 && (!!S.props.getNodePropVal(J.NodeProp.INLINE_CHILDREN, this.node) || this.node.id === state.node.id)) {
        }
        else {
            layoutClass += state.userPreferences.editMode && state.userPreferences.showMetaData ? " row-border-edit" : " row-border";
        }

        let indentLevel = this.isTableCell ? 0 : this.level;
        let style = indentLevel > 0 ? { marginLeft: "" + ((indentLevel - 1) * 30) + "px" } : null;
        let focusNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
        let selected: boolean = (focusNode && focusNode.id === id);
        this.attribs.className = (layoutClass || "") + (selected ? " active-row" : " inactive-row");

        if (S.render.enableRowFading && S.render.fadeInId === node.id && S.render.allowFadeInId) {
            S.render.fadeInId = null;
            S.render.allowFadeInId = false;
            this.attribs.className += " fadeInRowBkgClz";
            S.meta64.fadeStartTime = new Date().getTime();
        }

        this.attribs.style = style;

        let header: CompIntf = null;
        let jumpButton: CompIntf = null;
        if (this.allowHeaders && state.userPreferences.showMetaData) {
            header = new NodeCompRowHeader(node, true, true, false, false);
        }
        else {
            const targetId = S.props.getNodePropVal(J.NodeProp.TARGET_ID, node);
            if (targetId) {
                jumpButton = new IconButton("fa-arrow-right", null, {
                    onClick: () => S.view.jumpToId(targetId),
                    title: "Jump to the Node"
                }, "float-right");
            }
        }

        // if editMode is on, an this isn't the page root node
        if (state.userPreferences.editMode && this.node.id !== state.node.id) {
            S.render.setNodeDropHandler(this.attribs, this.node, true, state);
        }

        this.setChildren([
            this.isTableCell ? null : insertInlineButton,
            header,
            buttonBar,
            buttonBar ? new Clearfix("button_bar_clearfix_" + node.id) : null,
            jumpButton,
            new NodeCompContent(node, true, true, null, null, this.imgSizeOverride, true),
            this.allowHeaders ? new NodeCompRowFooter(node, false) : null
        ]);
    }
}
