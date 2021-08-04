import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { NodeActionType } from "../enums/NodeActionType";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Checkbox } from "../widget/Checkbox";
import { Div } from "../widget/Div";
import { Icon } from "../widget/Icon";
import { IconButton } from "../widget/IconButton";
import { Span } from "../widget/Span";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompButtonBar extends Div {

    constructor(public node: J.NodeInfo, public allowNodeMove: boolean, private level: number, private extraButtons: IconButton[], private extraClass: string) {
        super(null, {
            id: "NodeCompButtonBar_" + node.id,
            className: "marginLeft " + extraClass
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let node = this.node;
        if (!node) {
            this.setChildren(null);
            return;
        }

        let encIcon: Icon;
        let sharedIcon: Icon;
        let openButton: Button;
        let selButton: Checkbox;
        let createSubNodeButton: Button;
        let editNodeButton: Button;
        let insertNodeButton: Button;
        let cutNodeButton: Icon;
        let moveNodeUpButton: Icon;
        let moveNodeDownButton: Icon;
        let deleteNodeButton: Icon;
        let pasteButtons: Span;

        let isPageRootNode = state.node && this.node.id === state.node.id;
        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(node.type);
        let editingAllowed = S.edit.isEditAllowed(node, state);
        let deleteAllowed = false;
        let editableNode = true;

        if (state.isAdminUser) {
            editingAllowed = true;
            deleteAllowed = true;
            editableNode = true;
        }
        else if (typeHandler) {
            if (editingAllowed) {
                editingAllowed = typeHandler.allowAction(NodeActionType.editNode, node, state);
                deleteAllowed = typeHandler.allowAction(NodeActionType.delete, node, state);
                editableNode = typeHandler.allowAction(NodeActionType.editNode, node, state);
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

        if (S.props.isEncrypted(node)) {
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
                onClick: () => S.share.editNodeSharing(state, node),
                title: "Shared to:\n" + sharingNames
            });
        }
        */

        let isInlineChildren = !!S.props.getNodePropVal(J.NodeProp.INLINE_CHILDREN, node);

        /*
        We always enable for fs:folder, to that by clicking to open a folder that will cause the server to re-check and see if there are
        truly any files in there or not because we really cannot possibly know until we look. The only way to make this Open button
        ONLY show when there ARE truly children fore sure would be to force a check of the file system for every folder type that is ever rendered
        on a page and we don't want to burn that much CPU just to prevent empty-folders from being explored. Empty folders are rare.
        */
        if (node.hasChildren && !isPageRootNode &&
            // If children are shown inline, no need to allow 'open' button in this case unless we're in edit mode
            (!isInlineChildren || state.userPreferences.editMode)) {

            openButton = new Button(null, S.nav.openNodeById, {
                iconclass: "fa fa-folder-open",
                nid: node.id,
                title: "Open Node to access its children"
            }, "btn-primary");
        }

        /*
         * If in edit mode we always at least create the potential (buttons) for a user to insert content, and if
         * they don't have privileges the server side security will let them know. In the future we can add more
         * intelligence to when to show these buttons or not.
         */
        if (state.userPreferences.editMode) {
            let checkboxForEdit = editingAllowed && (state.isAdminUser || S.render.allowAction(typeHandler, NodeActionType.editNode, node, state));
            let checkboxForDelete = state.isAdminUser || deleteAllowed;

            if ((checkboxForEdit || checkboxForDelete) &&
                // no need to ever select home node
                node.id !== state.homeNodeId) {
                selButton = new Checkbox(null, {
                    title: "Select Node for multi-node functions."
                }, {
                    setValue: (checked: boolean): void => {
                        if (checked) {
                            state.selectedNodes[node.id] = true;
                        } else {
                            delete state.selectedNodes[node.id];
                        }
                    },
                    getValue: (): boolean => {
                        return !!state.selectedNodes[node.id];
                    }
                }, true);
            }

            let insertAllowed = true;

            // if this is our own account node, we can always leave insertAllowed=true
            if (state.homeNodeId !== node.id) {
                if (typeHandler) {
                    insertAllowed = state.isAdminUser || typeHandler.allowAction(NodeActionType.insert, node, state);
                }
            }
            let editInsertAllowed = S.edit.isInsertAllowed(node, state);

            if (C.NEW_ON_TOOLBAR && insertAllowed && editInsertAllowed && !state.editNode) {
                createSubNodeButton = new Button(null, S.edit.newSubNode, {
                    iconclass: "fa fa-plus",
                    nid: node.id,
                    title: "Create new Node (as child of this node)"
                });
            }

            if (C.INS_ON_TOOLBAR) {
                // todo-1: this button should have same enablement as "new" button, on the page root ???
                insertNodeButton = new Button("Ins", S.edit.toolbarInsertNode, {
                    title: "Insert new Node at this location.",
                    nid: node.id
                });
            }

            let userCanPaste = S.props.isMine(node, state) || state.isAdminUser || node.id === state.homeNodeId;

            if (editingAllowed) {
                if (editableNode && !state.editNode) {
                    editNodeButton = new Button(null, S.edit.runEditNodeByClick, {
                        iconclass: "fa fa-edit",
                        title: "Edit Node",
                        nid: node.id
                    });
                }

                if (!isPageRootNode && node.type !== J.NodeType.REPO_ROOT && !state.nodesToMove) {
                    cutNodeButton = new Icon({
                        className: "fa fa-cut fa-lg buttonBarIcon",
                        title: "Cut selected Node(s) to paste elsewhere.",
                        nid: node.id,
                        onClick: S.edit.cutSelNodes
                    });
                }

                if (C.MOVE_UPDOWN_ON_TOOLBAR && this.allowNodeMove) {

                    if (node.logicalOrdinal > 0) {
                        moveNodeUpButton = new Icon({
                            className: "fa fa-arrow-up buttonBarIcon",
                            title: "Move Node up one position (higher)",
                            nid: node.id,
                            onClick: S.edit.moveNodeUp
                        });
                    }

                    if (!node.lastChild && state.node.children && state.node.children.length > 1) {
                        moveNodeDownButton = new Icon({
                            className: "fa fa-arrow-down buttonBarIcon",
                            title: "Move Node down one position (lower)",
                            nid: node.id,
                            onClick: S.edit.moveNodeDown
                        });
                    }
                }
            }

            if (deleteAllowed) {
                // not user's account node!
                if (node.id !== state.homeNodeId) {
                    deleteNodeButton = new Icon({
                        className: "fa fa-trash fa-lg buttonBarIcon",
                        title: "Delete selected nodes",
                        nid: node.id,
                        onClick: S.edit.deleteSelNodes
                    });
                }
            }

            if (!!state.nodesToMove && userCanPaste) {
                pasteButtons = new Span(null, { className: "float-right marginLeft" }, [
                    new Button("Paste Inside",
                        S.edit.pasteSelNodesInside, { nid: node.id }, "btn-secondary pasteButton"),

                    node.id !== state.homeNodeId
                        ? new Button("Paste Here", S.edit.pasteSelNodes_InlineAbove, { nid: node.id }, "btn-secondary pasteButton") : null
                ]);
            }
        }

        let btnArray: Comp[] = [openButton, insertNodeButton, createSubNodeButton, editNodeButton,
            new Span(null, { className: "float-right" }, [moveNodeUpButton, //
                moveNodeDownButton, cutNodeButton, deleteNodeButton, pasteButtons])];

        if (this.extraButtons) {
            btnArray = btnArray.concat(this.extraButtons);
        }

        let buttonBar = new ButtonBar(btnArray, null, "marginLeftIfNotFirst");
        let navButtonBar = null;

        if (isPageRootNode) {
            let upLevelButton: IconButton;
            let prevButton: IconButton;
            let nextButton: IconButton;
            let searchButton: IconButton;
            let timelineButton: IconButton;

            if (state.node && this.node.id === state.node.id) {
                if (S.nav.parentVisibleToUser(state)) {
                    upLevelButton = new IconButton("fa-folder", "Up", {
                        nid: node.id,
                        /* For onclick functions I need a new approach for some (not all) where I can get by
                        with using a function that accepts no arguments but does the trick of retrieving the single ID parameter
                        directly off the DOM */
                        onClick: S.nav.navUpLevelClick,
                        title: "Go to Parent Node"
                    }, "btn-primary");
                }

                if (!S.nav.displayingRepositoryRoot(state)) {
                    prevButton = new IconButton("fa-chevron-circle-left", null, {
                        onClick: S.nav.navToPrev,
                        title: "Go to Previous Node"
                    });

                    nextButton = new IconButton("fa-chevron-circle-right", null, {
                        onClick: S.nav.navToNext,
                        title: "Go to Next Node"
                    });
                }

                searchButton = new IconButton("fa-search", null, {
                    onClick: S.nav.runSearch,
                    title: "Search underneath Node"
                });

                timelineButton = new IconButton("fa-clock-o", null, {
                    onClick: S.nav.runTimeline,
                    title: "View Timeline (by Mod Time)"
                });
            }

            navButtonBar = new ButtonBar([searchButton, timelineButton, prevButton, nextButton, upLevelButton],
                null, "float-right marginBottom");
            if (!navButtonBar.hasChildren()) {
                navButtonBar = null;
            }
        }

        if (buttonBar && !buttonBar.hasChildren()) {
            buttonBar = null;
        }

        this.setChildren([selButton, encIcon, sharedIcon, buttonBar, navButtonBar]);
    }
}
