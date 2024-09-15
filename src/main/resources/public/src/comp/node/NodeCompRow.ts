import { getAs } from "../../AppContext";
import { Comp } from "../../comp/base/Comp";
import { Button } from "../../comp/core/Button";
import { Clearfix } from "../../comp/core/Clearfix";
import { Div } from "../../comp/core/Div";
import { IconButton } from "../../comp/core/IconButton";
import { Constants as C } from "../../Constants";
import { EditNodeDlg } from "../../dlg/EditNodeDlg";
import { TabBase } from "../../intf/TabBase";
import { NodeActionType, TypeIntf } from "../../intf/TypeIntf";
import * as J from "../../JavaIntf";
import { NodeInfo, PrincipalName } from "../../JavaIntf";
import { S } from "../../Singletons";
import { FlexLayout } from "../core/FlexLayout";
import { NodeCompButtonBar } from "./NodeCompButtonBar";
import { NodeCompContent } from "./NodeCompContent";
import { NodeCompRowHeader } from "./NodeCompRowHeader";

export class NodeCompRow extends Div {

    constructor(public node: NodeInfo, public tabData: TabBase<any>, private type: TypeIntf,
        public index: number, public count: number, public rowCount: number, public level: number,
        public isTableCell: boolean, public allowNodeMove: boolean, private allowHeaders: boolean,
        public allowInlineInsertButton: boolean, private internalComp: Div) {
        super(null, {
            id: C.TAB_MAIN + node.id
            // WARNING: Leave this tabIndex here. it's required for focsing/scrolling
            // tabIndex: "-1"
        });
    }

    override preRender(): boolean | null {
        const ast = getAs();

        if (this.allowHeaders) {
            this.attribs[C.NODE_ID_ATTR] = this.node.id;
            this.attribs.onClick = S.nav.clickTreeNode;
        }
        let insertInlineButton = null;
        const isPageRootNode = ast.node && this.node.id === ast.node.id;

        if (this.allowHeaders && ast.userPrefs.editMode) {
            let insertAllowed = true;

            /* if we are at level one that means state.node is the parent of 'this.node' so that's
            what determines if we can insert or not */
            if (this.level === 1) {
                const parentType = S.plugin.getType(ast.node.type);
                if (parentType) {
                    insertAllowed = ast.isAdminUser || parentType.allowAction(NodeActionType.insert, ast.node);
                }
            }

            const isMine = S.props.isMine(ast.node);

            if (isMine && this.allowInlineInsertButton && !isPageRootNode && insertAllowed) {

                let insertButton: Button = null;
                insertInlineButton = new Div(null, { className: "marginLeft" }, [
                    insertButton = new Button(null, () => {
                        S.edit.insertNode(this.node.id, 0, ast);
                    }, {
                        title: "Insert new node" + (this.isTableCell ? " (above this one)" : "")
                    }, "btn-secondary  ui-new-node-plus " + (this.isTableCell ? "" : "plusButtonFloatRight"), "fa-plus")
                ]);

                S.domUtil.setDropHandler(insertButton.attribs, (evt: DragEvent) => {
                    for (const item of evt.dataTransfer.items) {
                        // console.log("DROP(d) kind=" + item.kind + " type=" + item.type);
                        if (item.kind === "file") {
                            EditNodeDlg.pendingUploadFile = item.getAsFile();
                            S.edit.insertNode(this.node.id, 0, ast);
                            return;
                        }
                    }
                });
            }
        }

        let buttonBar = null;
        if (this.allowHeaders) {
            buttonBar = new NodeCompButtonBar(this.node, this.isTableCell, this.level, this.allowNodeMove, this.isTableCell ? [insertInlineButton] : null, null, this.tabData);
        }

        let layoutClass = this.isTableCell ? "nodeGridItem" //
            : (this.tabData.id === C.TAB_MAIN && ast.userPrefs.editMode && //
                S.util.showMetaData(ast, this.node) ? "nodeTableRowEdit" : "nodeTableRow");
        layoutClass += " " + this.tabData.id;

        // const layout = S.props.getPropStr(J.NodeProp.LAYOUT, this.node);
        const isInlineChildren = !!S.props.getPropStr(J.NodeProp.INLINE_CHILDREN, this.node);

        let allowHeader: boolean = false;
        // special case, if node is owned by admin and we're not admin, never show header
        if (!C.ALLOW_ADMIN_NODE_HEADERS && this.node.owner === PrincipalName.ADMIN && ast.userName !== PrincipalName.ADMIN) {
            // leave allowHeader false.
        }
        else {
            allowHeader = this.allowHeaders && S.util.showMetaData(ast, this.node) && (this.type == null || this.type?.getAllowRowHeader())
        }

        // if this node has children as columnar layout, and is rendering as the root node of a page
        // or a node that is expanded inline, that means there will be a grid below this node so we
        // don't show the border (bottom divider line) because it's more attractive not to.
        if (this.isTableCell) {
            // do nothing
        }
        // else if (layout && layout.indexOf("c") === 0 && (isInlineChildren || this.node.id === state.node.id)) {
        // }
        else {
            // special class if BOTH edit and info is on
            if (allowHeader && this.tabData.id === C.TAB_MAIN && ast.userPrefs.editMode && //
                S.util.showMetaData(ast, this.node)) {
            }
            // else if either is on
            else if (ast.userPrefs.editMode || S.util.showMetaData(ast, this.node)) {
                layoutClass += " rowBorderEdit";
            }
            else if (isInlineChildren && this.node.hasChildren && !isPageRootNode) {
                layoutClass += " rowBorderInlineChildren";
            }
            else {
                layoutClass += " row-border";
            }
        }
        const indentLevel = this.isTableCell ? 0 : this.level;
        const focusNode = S.nodeUtil.getHighlightedNode();
        const selected: boolean = (focusNode && focusNode.id === this.node.id);

        let selectionClass;
        if (selected) {
            selectionClass = this.isTableCell ? " activeRowCell" : " activeRow";
        }
        else {
            selectionClass = this.isTableCell ? " inactiveRowCell" : (indentLevel > 1 ? " inactiveRowIndented" : " inactiveRow");
        }
        this.attribs.className = (layoutClass || "") + selectionClass;

        if (indentLevel > 0) {
            this.attribs.style = { marginLeft: "" + ((indentLevel - 1) * 30) + "px" };
        }

        if (S.render.enableRowFading && S.render.fadeInId === this.node.id && S.render.allowFadeInId) {
            S.render.fadeInId = null;
            S.render.allowFadeInId = false;
            this.attribs.className += " fadeInRowBkgClz";
            S.quanta.fadeStartTime = new Date().getTime();
        }

        let header: NodeCompRowHeader = null;
        let jumpButton: Comp = null;

        if (allowHeader) {
            // slight special case for now until Document View knows how to delete all the
            // subchilren and not show orphans on the page when something is deleted. Other panels
            // don't have this problem
            const showJumpButton = this.tabData.id !== C.TAB_MAIN;
            header = new NodeCompRowHeader(this.node, true, true, this.tabData, showJumpButton, this.tabData.id, this.rowCount, indentLevel, this.isTableCell);
        }
        else {
            const targetId = S.props.getPropStr(J.NodeProp.TARGET_ID, this.node);
            if (targetId) {
                jumpButton = new IconButton("fa-arrow-right", null, {
                    [C.NODE_ID_ATTR]: targetId,
                    onClick: S.nav.jumpToNode,
                    title: "Jump to Node"
                }, "btn-secondary float-end");
            }
        }

        // if editMode is on, an this isn't the page root node
        if (ast.userPrefs.editMode) {
            S.render.setNodeDropHandler(this.attribs, this.node);
        }

        // if we're on the tree view and have a simple layout where all we copuld need is an expand/collapse button and markdown
        // then we display the expand button and markdonw in a size by side layout
        if (this.node.hasChildren && this.tabData.id === C.TAB_MAIN && !ast.userPrefs.editMode) {
            const exp = !!S.props.getPropStr(J.NodeProp.INLINE_CHILDREN, this.node);
            const isMine = S.props.isMine(this.node);
            let openButton = null;
            if (!(exp && !isMine)) {
                openButton = new IconButton("fa-folder-open", null, {
                    [C.NODE_ID_ATTR]: this.node.id,
                    onClick: S.nav.openNodeById,
                    title: "Explore content of this node"
                }, "btn-primary marginLeft");
            }

            this.children = [
                this.isTableCell ? null : insertInlineButton,
                S.render.renderLinkLabel(this.node.id),
                header,
                new FlexLayout([
                    openButton,
                    new NodeCompContent(this.node, this.tabData, true, true, this.tabData.id, null, true, "inlineBlock")
                ], "flexAlignChildrenTop"),
                this.internalComp,
                S.render.renderLinks(this.node, this.tabData)
            ];
        }
        else {
            this.children = [
                this.isTableCell ? null : insertInlineButton,
                S.render.renderLinkLabel(this.node.id),
                header,
                buttonBar,
                buttonBar ? new Clearfix() : null,
                jumpButton,
                new NodeCompContent(this.node, this.tabData, true, true, this.tabData.id, null, true, null),
                this.internalComp,
                S.render.renderLinks(this.node, this.tabData)
            ];
        }
        return true;
    }
}
