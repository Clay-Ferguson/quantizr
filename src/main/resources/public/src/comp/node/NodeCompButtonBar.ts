import { dispatch, getAs } from "../../AppContext";
import { Comp } from "../../comp/base/Comp";
import { Button } from "../../comp/core/Button";
import { ButtonBar } from "../../comp/core/ButtonBar";
import { Checkbox } from "../../comp/core/Checkbox";
import { Div } from "../../comp/core/Div";
import { Icon } from "../../comp/core/Icon";
import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { NodeActionType } from "../../intf/TypeIntf";
import * as J from "../../JavaIntf";
import { NodeInfo } from "../../JavaIntf";
import { S } from "../../Singletons";
import { Span } from "../core/Span";

export class NodeCompButtonBar extends Comp {

    constructor(public node: NodeInfo, public isTableCell, public level: number, public allowNodeMove: boolean,
        private extraButtons: Comp[], extraClass: string, public tabData: TabBase<any>) {
        super({
            id: "ncbb_" + node.id,
            className: "nodeCompButtonBar " + (extraClass || "")
        });
    }

    override preRender(): boolean | null {
        const ast = getAs();
        if (!this.node) {
            this.children = null;
            return false;
        }

        let openButton: Button;
        let expnButton: Button;
        let selCheckbox: Checkbox;
        let dragIcon: Icon;
        let createSubNodeButton: Button;
        let editNodeButton: Button;
        let addDelete: boolean = false;
        let askDelDiv: Div;
        let pasteSpan: Span;

        const isPageRootNode = ast.node && this.node.id === ast.node.id;
        const type = S.plugin.getType(this.node.type);
        const specialAccountNode = type?.isSpecialAccountNode() || type?.getTypeName() == J.NodeType.ACCOUNT;
        if (specialAccountNode) this.allowNodeMove = false;
        let editingAllowed = S.edit.isEditAllowed(this.node);
        let deleteAllowed = false;
        let editableNode = true;

        if (ast.isAdminUser) {
            editingAllowed = true;
            deleteAllowed = true;
            editableNode = true;
        }
        else if (type) {
            if (editingAllowed) {
                editingAllowed = type.allowAction(NodeActionType.editNode, this.node);
                deleteAllowed = type.allowAction(NodeActionType.delete, this.node);
                editableNode = type.allowAction(NodeActionType.editNode, this.node);
            }
        }
        else {
            if (editingAllowed) {
                deleteAllowed = true;
            }
        }

        // const layout = S.props.getPropStr(J.NodeProp.LAYOUT, this.node);
        const allowExpnButton = !ast.isAnonUser && !this.isTableCell; // && (!layout || layout == "c1");
        let expandChildren = false;

        if (allowExpnButton) {
            const expandByUser: string = S.props.getClientPropStr(J.NodeProp.EXPANSION_BY_USER, this.node);

            // if we have a string, the user has clicked the expansion state and overridden it.
            if (expandByUser?.length == 1) {
                expandChildren = expandByUser === "1";
            }
            // otherwise expansion state is controlled by what's on the node itself.
            else {
                expandChildren = !!S.props.getPropStr(J.NodeProp.INLINE_CHILDREN, this.node);
            }
        }

        /*
        We always enable for fs:folder, to that by clicking to open a folder that will cause the
        server to re-check and see if there are truly any files in there or not because we really
        cannot possibly know until we look. The only way to make this Open button ONLY show when
        there ARE truly children fore sure would be to force a check of the file system for every
        folder type that is ever rendered on a page and we don't want to burn that much CPU just to
        prevent empty-folders from being explored. Empty folders are rare.
        */
        if (this.node.hasChildren && !isPageRootNode) {
            const exp = !!S.props.getPropStr(J.NodeProp.INLINE_CHILDREN, this.node);
            const isMine = S.props.isMine(this.node);

            if (!(exp && !isMine)) {
                openButton = new Button(null, S.nav._openNodeById, {
                    [C.NODE_ID_ATTR]: this.node.id,
                    title: "Explore content of this node"
                }, "-primary", "fa-folder-open");
            }

            // for now, let's go back to only showing expand/collapse button for our own nodes
            if (isMine && ast.userPrefs.editMode) {
                expnButton = new Button(null, S.nav._toggleNodeInlineChildren, {
                    [C.NODE_ID_ATTR]: this.node.id,
                    title: expandChildren ? "Collapse Children" : "Expand Children"
                }, null, expandChildren ? "fa-caret-up fa-lg" : "fa-caret-down fa-lg");
            }
        }

        const iconClazz = "buttonBarIcon";

        /*
         * If in edit mode we always at least create the potential (buttons) for a user to insert
         * content, and if they don't have privileges the server side security will let them know.
         * In the future we can add more intelligence to when to show these buttons or not.
         */
        const dragIconClazz = "fas fa-grip-lines-vertical fa-lg"
        if (ast.userPrefs.editMode) {
            if ((!type || type.subOrdinal() === -1) && S.props.isMine(this.node)) {
                dragIcon = new Icon({
                    className: dragIconClazz + " dragIcon",
                    title: "Drag to move this node"
                });

                S.domUtil.setNodeDragHandler(dragIcon.attribs, this.node.id, false);
            }

            const checkboxForEdit = editingAllowed && (ast.isAdminUser || S.render.allowAction(type, NodeActionType.editNode, this.node));
            const checkboxForDelete = ast.isAdminUser || deleteAllowed;

            if ((checkboxForEdit || checkboxForDelete) && !specialAccountNode) {
                selCheckbox = new Checkbox(null, {
                    title: "Select nodes"
                }, {
                    setValue: (checked: boolean) => {
                        dispatch("NodeCheckboxChange", s => {
                            if (checked) {
                                s.selectedNodes.add(this.node.id);
                            } else {
                                s.selectedNodes.delete(this.node.id);
                            }
                        });
                    },
                    getValue: (): boolean => ast.selectedNodes.has(this.node.id)
                }, "formCheckInlineNoMargin");
            }

            let insertAllowed = true;

            // if this is our own account node, we can always leave insertAllowed=true
            if (ast.userProfile?.userNodeId !== this.node.id) {
                if (type) {
                    insertAllowed = ast.isAdminUser || type.allowAction(NodeActionType.insert, this.node);
                }
            }

            const editInsertAllowed = S.props.isMine(this.node); //S.props.isWritableByMe(this.node);

            if (C.NEW_ON_TOOLBAR && insertAllowed && editInsertAllowed) {
                createSubNodeButton = new Button(null, S.edit._newSubNode, {
                    [C.NODE_ID_ATTR]: this.node.id,
                    title: "Create new SubNode"
                }, "ui-new-node-plus", "fa-plus");
            }

            const userCanPaste = S.props.isMine(this.node) || ast.isAdminUser || this.node.id === ast.userProfile?.userNodeId;

            if (editingAllowed) {
                if (editableNode && !specialAccountNode) {
                    editNodeButton = new Button(null, S.edit._runEditNodeByClick, {
                        title: "Edit Node",
                        [C.NODE_ID_ATTR]: this.node.id
                    }, "ui-edit-node", "fa-edit");
                }
            }

            if (deleteAllowed) {
                // not this user's own account node!
                if (this.node.id !== ast.userProfile?.userNodeId) {
                    askDelDiv = this.node.id == ast.nodeClickedToDel ? S.render.makeDeleteQuestionDiv() : null;

                    if (!askDelDiv) {
                        addDelete = true;
                    }
                }
            }

            if (!!ast.nodesToMove && userCanPaste) {
                pasteSpan = new Span(null, { className: "float-right ml-3" }, [
                    new Button("Paste Inside",
                        S.edit._pasteSelNodesInside, { [C.NODE_ID_ATTR]: this.node.id }, "pasteButton"),

                    this.node.id !== ast.userProfile?.userNodeId
                        ? new Button("Paste Here", S.edit._pasteSelNodes_InlineAbove, { [C.NODE_ID_ATTR]: this.node.id }, "pasteButton") : null
                ]);
            }
        }

        let floatEndSpan = null;
        const spanArray: Comp[] = [
            addDelete ? new Icon({
                className: "fa fa-trash fa-lg " + iconClazz,
                title: "Delete node(s)",
                [C.NODE_ID_ATTR]: this.node.id,
                onClick: this.tabData.id == C.TAB_MAIN ? S.edit._deleteSelNodes : S.edit._deleteOneNode
            }) : null
        ];

        if (askDelDiv) {
            spanArray.push(askDelDiv);
        }
        if (pasteSpan) {
            spanArray.push(pasteSpan);
        }
        if (spanArray.some(c => !!c)) {
            floatEndSpan = new Span(null, { className: "float-right" }, spanArray);
        }

        let btnArray: Comp[] = [openButton, expnButton, /* upLevelButton,*/ createSubNodeButton, editNodeButton, floatEndSpan];

        btnArray = btnArray.concat(this.extraButtons);

        let buttonBar: ButtonBar = null;
        if (btnArray.some(c => !!c)) {
            buttonBar = new ButtonBar(btnArray);
        }

        if (dragIcon || selCheckbox || buttonBar) {
            this.children = [dragIcon, selCheckbox, buttonBar];
            return true;
        }
        return false;
    }
}
