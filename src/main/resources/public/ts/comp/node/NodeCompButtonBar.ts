import { dispatch, useAppState } from "../../AppContext";
import { Comp } from "../../comp/base/Comp";
import { Button } from "../../comp/core/Button";
import { ButtonBar } from "../../comp/core/ButtonBar";
import { Checkbox } from "../../comp/core/Checkbox";
import { Div } from "../../comp/core/Div";
import { Icon } from "../../comp/core/Icon";
import { IconButton } from "../../comp/core/IconButton";
import { Span } from "../../comp/core/Span";
import { Constants as C } from "../../Constants";
import { NodeActionType } from "../../intf/TypeHandlerIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";

export class NodeCompButtonBar extends Div {

    constructor(public node: J.NodeInfo, public allowNodeMove: boolean, private level: number, private extraButtons: Comp[], private extraClass: string) {
        super(null, {
            id: "ncbb_" + node.id,
            className: "nodeCompButtonBar " + (extraClass || "")
        });
    }

    preRender(): void {
        const state = useAppState();

        // make drop target if not a drop-on-self
        if (S.quanta.draggableId !== this.node.id) {
            this.makeDropTarget(this.attribs, this.node.id);
        }

        if (!this.node) {
            this.setChildren(null);
            return;
        }

        let encIcon: Icon;
        let sharedIcon: Icon;
        let openButton: Button;
        let selCheckbox: Checkbox;
        let createSubNodeButton: Button;
        let editNodeButton: Button;
        let cutNodeIcon: Icon;
        let moveNodeUpIcon: Icon;
        let moveNodeDownIcon: Icon;
        let deleteNodeIcon: Icon;
        let pasteSpan: Span;

        const isPageRootNode = state.node && this.node.id === state.node.id;
        const typeHandler = S.plugin.getTypeHandler(this.node.type);
        let editingAllowed = S.edit.isEditAllowed(this.node, state);
        let deleteAllowed = false;
        let editableNode = true;

        if (state.isAdminUser) {
            editingAllowed = true;
            deleteAllowed = true;
            editableNode = true;
        }
        else if (typeHandler) {
            if (editingAllowed) {
                editingAllowed = typeHandler.allowAction(NodeActionType.editNode, this.node, state);
                deleteAllowed = typeHandler.allowAction(NodeActionType.delete, this.node, state);
                editableNode = typeHandler.allowAction(NodeActionType.editNode, this.node, state);
            }
        }
        else {
            // bug fix. this case was not covered.
            if (editingAllowed) {
                deleteAllowed = true;
            }
        }

        /* putting this logic separate from setters above, but this is because we don't allow the actual page root
        to be deleted WHILE you're looking at it */
        if (isPageRootNode) {
            deleteAllowed = false;
        }

        if (S.props.isEncrypted(this.node)) {
            encIcon = new Icon({
                className: "fa fa-lock fa-lg rowIcon",
                title: "Node is Encrypted."
            });
        }

        /* DO NOT DELETE
            todo-2: need to make this if condition:
             if ((state.isAdminUser || S.props.isMine(node, state)) && S.props.isShared(node)) {
            show cause a clickable link to show up on the "shared to: " text
            to run the editNodeSharing()
           (I may bring this back eventually, but for now the fact that the sharing is being presented
            in the header of each node we don't need this icon and popup text )
        if (S.props.isShared(node)) {
            let sharingNames = S.util.getSharingNames(node, true);
            sharedIcon = new Icon({
                className: "fa fa-share-alt fa-lg rowIcon",
                onClick: () => S.edit.editNodeSharing(state, node),
                title: "Shared to:\n" + sharingNames
            });
        }
        */

        const isInlineChildren = !!S.props.getPropStr(J.NodeProp.INLINE_CHILDREN, this.node);

        /*
        We always enable for fs:folder, to that by clicking to open a folder that will cause the server to re-check and see if there are
        truly any files in there or not because we really cannot possibly know until we look. The only way to make this Open button
        ONLY show when there ARE truly children fore sure would be to force a check of the file system for every folder type that is ever rendered
        on a page and we don't want to burn that much CPU just to prevent empty-folders from being explored. Empty folders are rare.
        */
        if (this.node.hasChildren && !isPageRootNode &&
            // If children are shown inline, no need to allow 'open' button in this case unless we're in edit mode
            (!isInlineChildren || state.userPrefs.editMode)) {
            openButton = new Button(null, S.nav.openNodeById, {
                nid: this.node.id,
                title: "Open Node"
            }, "btn-primary", "fa-folder-open");
        }

        /*
         * If in edit mode we always at least create the potential (buttons) for a user to insert content, and if
         * they don't have privileges the server side security will let them know. In the future we can add more
         * intelligence to when to show these buttons or not.
         */
        if (state.userPrefs.editMode) {
            const checkboxForEdit = editingAllowed && (state.isAdminUser || S.render.allowAction(typeHandler, NodeActionType.editNode, this.node, state));
            const checkboxForDelete = state.isAdminUser || deleteAllowed;

            if ((checkboxForEdit || checkboxForDelete) &&
                // no need to ever select home node
                this.node.id !== state.homeNodeId) {
                selCheckbox = new Checkbox(null, {
                    title: "Select Nodes."
                }, {
                    setValue: (checked: boolean) => {
                        dispatch("NodeCheckboxChange", s => {
                            if (checked) {
                                s.selectedNodes.add(this.node.id);
                            } else {
                                s.selectedNodes.delete(this.node.id);
                            }
                            return s;
                        });
                    },
                    getValue: (): boolean => state.selectedNodes.has(this.node.id)
                }, "float-start");
            }

            let insertAllowed = true;

            // if this is our own account node, we can always leave insertAllowed=true
            if (state.homeNodeId !== this.node.id) {
                if (typeHandler) {
                    insertAllowed = state.isAdminUser || typeHandler.allowAction(NodeActionType.insert, this.node, state);
                }
            }
            const editInsertAllowed = S.edit.isInsertAllowed(this.node, state);
            const isMine = S.props.isMine(this.node, state);

            if (C.NEW_ON_TOOLBAR && isMine && insertAllowed && editInsertAllowed && !isPageRootNode) {
                createSubNodeButton = new Button(null, S.edit.newSubNode, {
                    nid: this.node.id,
                    title: "Create new Node (as child of this node)"
                }, null, "fa-plus");
            }

            const userCanPaste = S.props.isMine(this.node, state) || state.isAdminUser || this.node.id === state.homeNodeId;

            if (editingAllowed) {
                if (editableNode) {
                    editNodeButton = new Button(null, S.edit.runEditNodeByClick, {
                        title: "Edit Node",
                        nid: this.node.id
                    }, null, "fa-edit");
                }

                if (!isPageRootNode && this.node.type !== J.NodeType.REPO_ROOT && !state.nodesToMove) {
                    cutNodeIcon = new Icon({
                        className: "fa fa-cut fa-lg buttonBarIcon",
                        title: "Cut selected Node(s) to paste elsewhere.",
                        nid: this.node.id,
                        onClick: S.edit.cutSelNodes
                    });
                }

                if (C.MOVE_UPDOWN_ON_TOOLBAR && this.allowNodeMove) {
                    if (this.node.logicalOrdinal > 0) {
                        moveNodeUpIcon = new Icon({
                            className: "fa fa-lg fa-arrow-up buttonBarIcon",
                            title: "Move Node up one position (higher)",
                            nid: this.node.id,
                            onClick: S.edit.moveNodeUp
                        });
                    }

                    if (!this.node.lastChild && state.node.children && state.node.children.length > 1) {
                        moveNodeDownIcon = new Icon({
                            className: "fa fa-lg fa-arrow-down buttonBarIcon",
                            title: "Move Node down one position (lower)",
                            nid: this.node.id,
                            onClick: S.edit.moveNodeDown
                        });
                    }
                }
            }

            if (deleteAllowed) {
                // not user's account node!
                if (this.node.id !== state.homeNodeId) {
                    deleteNodeIcon = new Icon({
                        className: "fa fa-trash fa-lg buttonBarIcon",
                        title: "Delete node(s)",
                        nid: this.node.id,
                        onClick: S.edit.deleteSelNodes
                    });
                }
            }

            if (!!state.nodesToMove && userCanPaste) {
                pasteSpan = new Span(null, { className: "float-end marginLeft" }, [
                    new Button("Paste Inside",
                        S.edit.pasteSelNodesInside, { nid: this.node.id }, "btn-secondary pasteButton"),

                    this.node.id !== state.homeNodeId
                        ? new Button("Paste Here", S.edit.pasteSelNodes_InlineAbove, { nid: this.node.id }, "btn-secondary pasteButton") : null
                ]);
            }
        }

        let searchIcon: Icon = null;
        let timelineIcon: Icon = null;
        let upLevelButton: IconButton;
        let prevButton: Button;
        let nextButton: Button;

        if (isPageRootNode) {
            if (S.nav.parentVisibleToUser(state)) {
                upLevelButton = new IconButton("fa-folder", "Up", {
                    nid: this.node.id,
                    /* For onclick functions I need a new approach for some (not all) where I can get by
                    with using a function that accepts no arguments but does the trick of retrieving the single ID parameter
                    directly off the DOM */
                    onClick: S.nav.navUpLevelClick,
                    title: "Go to Parent Node"
                }, "btn-primary");
            }

            if (!S.nav.displayingRepositoryRoot(state)) {
                prevButton = new Button(null, S.nav.navToPrev, {
                    className: "fa fa-chevron-circle-left",
                    title: "Previous Node"
                });

                nextButton = new Button(null, S.nav.navToNext, {
                    className: "fa fa-chevron-circle-right",
                    title: "Next Node"
                });
            }
        }

        if (isPageRootNode && this.node.hasChildren) {
            searchIcon = new Icon({
                className: "fa fa-search fa-lg buttonBarIcon",
                title: "Search underneath Node",
                nid: this.node.id,
                onClick: S.nav.runSearch
            });

            timelineIcon = new Icon({
                className: "fa fa-clock-o fa-lg buttonBarIcon",
                title: "View Timeline (by Mod Time)",
                nid: this.node.id,
                onClick: S.nav.runTimeline
            });
        }

        let btnArray: Comp[] = [openButton, upLevelButton, createSubNodeButton, editNodeButton, prevButton, nextButton,
            new Span(null, { className: "float-end" }, [moveNodeUpIcon, //
                moveNodeDownIcon, cutNodeIcon, deleteNodeIcon, searchIcon, timelineIcon, pasteSpan])];

        if (this.extraButtons) {
            btnArray = btnArray.concat(this.extraButtons);
        }

        let buttonBar = new ButtonBar(btnArray, null, "marginLeftIfNotFirst");
        if (buttonBar && !buttonBar.hasChildren()) {
            buttonBar = null;
        }

        this.setChildren([selCheckbox, encIcon, sharedIcon, buttonBar]);
    }

    makeDropTarget = (attribs: any, id: string) => {
        S.util.setDropHandler(attribs, true, (evt: DragEvent) => {
            // todo-2: right now we only actually support one file being dragged? Would be nice to support multiples
            for (const item of evt.dataTransfer.items) {
                if (item.kind === "string") {
                    item.getAsString((s) => {
                        S.edit.moveNodeByDrop(id, s, "inside", true);
                    });
                    return;
                }
            }
        });
    }
}
