import { useAppState } from "../../AppContext";
import { AppState } from "../../AppState";
import { CompIntf } from "../../comp/base/CompIntf";
import { Button } from "../../comp/core/Button";
import { Clearfix } from "../../comp/core/Clearfix";
import { Div } from "../../comp/core/Div";
import { IconButton } from "../../comp/core/IconButton";
import { Constants as C } from "../../Constants";
import { EditNodeDlg } from "../../dlg/EditNodeDlg";
import { TabIntf } from "../../intf/TabIntf";
import { NodeActionType, TypeHandlerIntf } from "../../intf/TypeHandlerIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { Icon } from "../core/Icon";
import { NodeCompButtonBar } from "./NodeCompButtonBar";
import { NodeCompContent } from "./NodeCompContent";
import { NodeCompRowFooter } from "./NodeCompRowFooter";
import { NodeCompRowHeader } from "./NodeCompRowHeader";

export class NodeCompRow extends Div {

    /* we have this flag so we can turn off buttons to troubleshoot performance. */
    static showButtonBar: boolean = true;

    // isLinkedNode means this node is rendered as a 'sub render' of some other node like it's a boost for example, and we're rendering the
    // content of the boost inside the node that boosted it. And the node that is rendering the boost will have it passed in as 'internalComp'
    constructor(public node: J.NodeInfo, public tabData: TabIntf<any>, private typeHandler: TypeHandlerIntf, public index: number, public count: number, public rowCount: number, public level: number,
        public isTableCell: boolean, public allowNodeMove: boolean, private allowHeaders: boolean,
        public allowInlineInsertButton: boolean, private allowShowThread: boolean, private isLinkedNode: boolean, private internalComp: Div, appState: AppState) {
        super(null, {
            id: S.nav._UID_ROWID_PREFIX + node.id
            // WARNING: Leave this tabIndex here. it's required for focsing/scrolling
            // tabIndex: "-1"
        });

        /* If we're in edit mode allow dragging. Note nodes with subOrdinals can't be dragged */
        if ((!typeHandler || typeHandler.subOrdinal() === -1) && appState.userPrefs.editMode && !appState.inlineEditId) {
            this.attribs.draggable = "true";
            this.attribs.onDragStart = (evt: any) => this.dragStart(evt, node.id);
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

        if (this.allowHeaders) {
            this.attribs.nid = this.node.id;
            this.attribs.onClick = S.nav.clickTreeNode;
        }

        let insertInlineButton = null;
        const isPageRootNode = state.node && this.node.id === state.node.id;

        if (this.allowHeaders && state.userPrefs.editMode) {
            let insertAllowed = true;

            /* if we are at level one that means state.node is the parent of 'this.node' so that's what determines if we
            can insert or not */
            if (this.level === 1) {
                const parentTypeHandler = S.plugin.getTypeHandler(state.node.type);
                if (parentTypeHandler) {
                    insertAllowed = state.isAdminUser || parentTypeHandler.allowAction(NodeActionType.insert, state.node, state);
                }
            }

            const isMine = S.props.isMine(state.node, state);

            if (isMine && this.allowInlineInsertButton && !isPageRootNode && this.level === 1 && insertAllowed) {

                let insertButton: Button = null;
                // todo-1: this button should have same enablement as "new" button, on the page root ???
                insertInlineButton = new Div(null, { className: "marginLeft" }, [
                    insertButton = new Button(null, () => {
                        S.edit.insertNode(this.node.id, J.NodeType.NONE, 0 /* isFirst ? 0 : 1 */, state);
                    }, {
                        title: "Insert new node" + (this.isTableCell ? " (above this one)" : "")
                    }, "btn-secondary " + (this.isTableCell ? "" : "plusButtonFloatRight"), "fa-plus")
                ]);

                // todo-1: Need to document this in "Tips and Tricks"
                S.domUtil.setDropHandler(insertButton.attribs, true, (evt: DragEvent) => {
                    for (const item of evt.dataTransfer.items) {
                        // console.log("DROP[" + i + "] kind=" + d.kind + " type=" + d.type);
                        if (item.kind === "file") {
                            EditNodeDlg.pendingUploadFile = item.getAsFile();
                            S.edit.insertNode(this.node.id, J.NodeType.NONE, 0 /* isFirst ? 0 : 1 */, state);
                            return;
                        }
                    }
                });
            }
        }

        let buttonBar = null;
        if (this.allowHeaders && NodeCompRow.showButtonBar && !state.inlineEditId) {
            buttonBar = new NodeCompButtonBar(this.node, this.allowNodeMove, this.level, this.isTableCell ? [insertInlineButton] : null, null);
        }

        let layoutClass = this.isTableCell ? "node-grid-item" : (state.userPrefs.editMode ? "node-table-row-edit" : "node-table-row");
        layoutClass += " " + this.tabData.id
        // const layout = S.props.getPropStr(J.NodeProp.LAYOUT, this.node);
        const isInlineChildren = !!S.props.getPropStr(J.NodeProp.INLINE_CHILDREN, this.node);

        // if this node has children as columnar layout, and is rendering as the root node of a page or a node that is expanded inline,
        // that means there will be a grid below this node so we don't show the border (bottom divider line) because it's more attractive not to.
        if (this.isTableCell) {
        }
        // else if (layout && layout.indexOf("c") === 0 && (isInlineChildren || this.node.id === state.node.id)) {
        // }
        else {
            if (isInlineChildren && this.node.hasChildren && !isPageRootNode) {
                layoutClass += state.userPrefs.editMode || state.userPrefs.showMetaData ? " row-border-edit" : " row-border-inline-children";
            }
            else {
                layoutClass += state.userPrefs.editMode || state.userPrefs.showMetaData ? " row-border-edit" : " row-border";
            }
        }

        const indentLevel = this.isTableCell ? 0 : this.level;
        const focusNode = S.nodeUtil.getHighlightedNode(state);
        const selected: boolean = (focusNode && focusNode.id === this.node.id);

        if (this.isLinkedNode) {
            this.attribs.className = "boost-row";
        }
        else {
            this.attribs.className = (layoutClass || "") + (selected ? " active-row" : " inactive-row");
            const style = indentLevel > 0 ? { marginLeft: "" + ((indentLevel - 1) * 30) + "px" } : null;
            this.attribs.style = style;
        }

        if (S.render.enableRowFading && S.render.fadeInId === this.node.id && S.render.allowFadeInId) {
            S.render.fadeInId = null;
            S.render.allowFadeInId = false;
            this.attribs.className += " fadeInRowBkgClz";
            S.quanta.fadeStartTime = new Date().getTime();
        }

        let header: NodeCompRowHeader = null;
        let jumpButton: CompIntf = null;

        let allowHeader: boolean = false;
        // special case, if node is owned by admin and we're not admin, never show header
        if (!C.ALLOW_ADMIN_NODE_HEADERS && this.node.owner === J.PrincipalName.ADMIN && state.userName !== J.PrincipalName.ADMIN) {
            // leave allowHeader false.
        }
        else {
            allowHeader = this.allowHeaders && state.userPrefs.showMetaData && (this.typeHandler == null || this.typeHandler?.getAllowRowHeader())
        }

        if (allowHeader) {
            // slight special case for now until Document View knows how to delete all the subchilren and not
            // show orphans on the page when something is deleted. Other panels don't have this problem
            // todo-1: it would be kind of easy to fix this, and make deleting from doc view work.
            const allowDelete = this.tabData.id !== C.TAB_DOCUMENT;
            const showJumpButton = this.tabData.id !== C.TAB_MAIN;
            header = new NodeCompRowHeader(this.node, true, true, false, showJumpButton, true, false, allowDelete);
        }
        else {
            const targetId = S.props.getPropStr(J.NodeProp.TARGET_ID, this.node);
            if (targetId) {
                jumpButton = new IconButton("fa-arrow-right", null, {
                    onClick: () => S.view.jumpToId(targetId),
                    title: "Jump to the Node"
                }, "btn-secondary float-end");
            }
        }

        // if editMode is on, an this isn't the page root node
        if (state.userPrefs.editMode && this.node.id !== state.node.id) {
            S.render.setNodeDropHandler(this.attribs, this.node, true, state);
        }

        // This icon for editing a node shows up if user has edit mode and info mode both off, and they own the node. This just makes
        // it easier to do a quick edit of a node without the need to turn edit mode on which clutters up the screen.
        let quickEditIcon: Icon = null;
        if (!this.isTableCell && !state.userPrefs.editMode && !state.userPrefs.showMetaData && S.props.isMine(this.node, state)) {
            quickEditIcon = new Icon({
                className: "fa fa-edit float-end quickEditIcon",
                title: "Edit this Node",
                nid: this.node.id,
                onClick: S.edit.runEditNodeByClick
            });
        }

        this.setChildren([
            this.isTableCell ? null : insertInlineButton,
            quickEditIcon,
            header,
            buttonBar,
            buttonBar ? new Clearfix() : null,
            jumpButton,
            new NodeCompContent(this.node, this.tabData, true, true, null, null, true, this.isLinkedNode, null),
            this.internalComp,
            this.allowHeaders ? new NodeCompRowFooter(this.node, false, this.allowShowThread) : null,
            this.allowHeaders ? new Clearfix() : null
        ]);
    }
}
