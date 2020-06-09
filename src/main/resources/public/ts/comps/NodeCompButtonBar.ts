import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Icon } from "../widget/Icon";
import { Button } from "../widget/Button";
import { Checkbox } from "../widget/Checkbox";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { Img } from "../widget/Img";
import { ButtonBar } from "../widget/ButtonBar";
import { HorizontalLayout } from "../widget/HorizontalLayout";
import { NavBarIconButton } from "../widget/NavBarIconButton";
import { AppState } from "../AppState";
import { useSelector, useDispatch } from "react-redux";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompButtonBar extends HorizontalLayout {

    constructor(public node: J.NodeInfo, public allowAvatar: boolean, public allowNodeMove: boolean) {
        super(null, "marginLeft marginTop", {
            id: "NodeCompButtonBar_" + node.id,
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let node = this.node;
        if (!node) {
            this.children = null;
            return;
        }

        let typeIcon: Icon;
        let encIcon: Icon;
        let sharedIcon: Icon;
        let openButton: Button;
        let selButton: Checkbox;
        let createSubNodeButton: Button;
        let editNodeButton: Button;
        let cutNodeButton: Button;
        let moveNodeUpButton: Button;
        let moveNodeDownButton: Button;
        let insertNodeButton: Button;
        let replyButton: Button;
        let deleteNodeButton: Button;
        let pasteInsideButton: Button;
        let upLevelButton: NavBarIconButton;
        let prevButton: NavBarIconButton;
        let nextButton: NavBarIconButton;
        let searchButton: NavBarIconButton;
        let timelineButton: NavBarIconButton;

        let isPageRootNode = state.node && this.node.id==state.node.id;

        if (state.node && this.node.id==state.node.id) {
            if (S.nav.parentVisibleToUser(state)) {
                upLevelButton = new NavBarIconButton("fa-chevron-circle-up", "Up Level", {
                    /* For onclick functions I need a new approach for some (not all) where I can get by 
                    with using a function that accepts no arguments but does the trick of retrieving the single ID parameter
                    directly off the DOM */
                    onClick: S.nav.navUpLevel,
                    title: "Go to Parent Node"
                });
            }

            if (!S.nav.displayingRepositoryRoot(state)) {
                prevButton = new NavBarIconButton("fa-chevron-circle-left", null, {
                    onClick: S.nav.navToPrev,
                    title: "Go to Previous Node"
                });

                nextButton = new NavBarIconButton("fa-chevron-circle-right", null, {
                    onClick: S.nav.navToNext,
                    title: "Go to Next Node"
                });
            }

            if (!state.isAnonUser) {
                searchButton = new NavBarIconButton("fa-search", null, {
                    onClick: S.nav.runSearch,
                    title: "Search underneath Node"
                });


                timelineButton = new NavBarIconButton("fa-clock-o", null, {
                    onClick: S.nav.runTimeline,
                    title: "View Timeline underneath Node (by Mod Time)"
                });
            }
        }

        //todo-1: need to DRY up places where this code block is repeated
        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(node.type);
        if (typeHandler) {
            let iconClass = typeHandler.getIconClass();
            if (iconClass) {
                typeIcon = new Icon({
                    className: iconClass + " rowIcon",
                    title: "Node Type: " + typeHandler.getName()
                });
            }
        }

        let editingAllowed = S.edit.isEditAllowed(node, state);
        if (typeHandler) {
            editingAllowed = editingAllowed && typeHandler.allowAction("edit");
        }

        if (S.props.isEncrypted(node)) {
            encIcon = new Icon({
                className: "fa fa-lock fa-lg rowIcon",
                title: "Node is Encrypted."
            });
        }

        if ((state.isAdminUser || S.props.isMine(node, state)) && S.props.isShared(node)) {
            sharedIcon = new Icon({
                className: "fa fa-share-alt fa-lg rowIcon",
                onClick: () => S.share.editNodeSharing(state, node),
                title: "Node is shared. Click to view sharing info."
            });
        }

        let isInlineChildren = !!S.props.getNodePropVal(J.NodeProp.INLINE_CHILDREN, node);

        /* Construct Open Button.

        We always enable for fs:folder, to that by clicking to open a folder that will cause the server to re-check and see if there are
        truly any files in there or not because we really cannot possibly know until we look. The only way to make this Open button
        ONLY show when there ARE truly children fore sure would be to force a check of the file system for every folder type that is ever rendered
        on a page and we don't want to burn that much CPU just to prevent empty-folders from being explored. Empty folders are rare.
        */
        if (node.hasChildren && !isPageRootNode && 
            //If children are shown inline, no need to allow 'open' button in this case unless we're in edit mode
            (!isInlineChildren || state.userPreferences.editMode)) {

            /* convert this button to a className attribute for styles */
            openButton = new Button("Open", S.meta64.getNodeFunc(S.nav.cached_openNodeById, "S.nav.openNodeById", node.id), 
            {title: "Open Node to access its children."}, "btn-primary");
        }

        /*
         * If in edit mode we always at least create the potential (buttons) for a user to insert content, and if
         * they don't have privileges the server side security will let them know. In the future we can add more
         * intelligence to when to show these buttons or not.
         */
        if (state.userPreferences.editMode) {
            // console.log("Editing allowed: " + nodeId);

            let selected: boolean = state.selectedNodes[node.id] ? true : false;

            if (editingAllowed && S.render.allowAction(typeHandler, "edit") &&
                //no need to ever select home node
                node.id != state.homeNodeId) {
                selButton = new Checkbox(null, selected, {
                    onChange: S.meta64.getNodeFunc(S.nav.cached_toggleNodeSel, "S.nav.toggleNodeSel", node.id),
                    title: "Select Node for multi-node functions."
                });
            }

            let insertAllowed = true;
            if (typeHandler) {
                insertAllowed = typeHandler.allowAction("insert");
            }

            if (C.NEW_ON_TOOLBAR && insertAllowed && S.edit.isInsertAllowed(node, state) &&
                //not page root node 'or' page no children exist.
                (node.id != state.node.id || !node.children || node.children.length == 0)) {
                createSubNodeButton = new Button("New", S.meta64.getNodeFunc(S.edit.cached_newSubNode, "S.edit.newSubNode", node.id),
                {title: "Create new Node as a child of this node."});
            }

            if (C.INS_ON_TOOLBAR) {
                insertNodeButton = new Button("Ins", S.meta64.getNodeFunc(S.edit.cached_toolbarInsertNode, "S.edit.toolbarInsertNode", node.id),
                {title: "Insert new Node at this location."});
            }

            if (editingAllowed) {
                editNodeButton = new Button(null, S.meta64.getNodeFunc(S.edit.cached_runEditNode, "S.edit.runEditNode", node.id), {
                    iconclass: "fa fa-edit fa-lg",
                    title: "Edit Node"
                });

                if (!isPageRootNode && node.type != J.NodeType.REPO_ROOT && !state.nodesToMove) {
                    cutNodeButton = new Button(null, S.meta64.getNodeFunc(S.edit.cached_cutSelNodes, "S.edit.cutSelNodes", node.id), {
                        iconclass: "fa fa-cut fa-lg",
                        title: "Cut selected Node(s) to paste elsewhere."
                    });
                }

                if (C.MOVE_UPDOWN_ON_TOOLBAR && this.allowNodeMove) {

                    if (!node.firstChild) {
                        moveNodeUpButton = new Button(null, S.meta64.getNodeFunc(S.edit.cached_moveNodeUp, "S.edit.moveNodeUp", node.id), {
                            iconclass: "fa fa-arrow-up fa-lg",
                            title: "Move Node up one position (higher)"
                        });
                    }

                    if (!node.lastChild && state.node.children && state.node.children.length > 1) {
                        moveNodeDownButton = new Button(null, S.meta64.getNodeFunc(S.edit.cached_moveNodeDown, "S.edit.moveNodeDown", node.id), {
                            iconclass: "fa fa-arrow-down fa-lg",
                            title: "Move Node down one position (lower)"
                        });
                    }
                }

                //not user's account node!
                if (node.id != state.homeNodeId) {
                    deleteNodeButton = new Button(null, S.meta64.getNodeFunc(S.edit.cached_softDeleteSelNodes, "S.edit.softDeleteSelNodes", node.id), {
                        iconclass: "fa fa-trash fa-lg",
                        title: "Move Node(s) to Trash Bin"
                    });
                }

                if (!state.isAnonUser && state.nodesToMove != null && (S.props.isMine(node, state) || node.id == state.homeNodeId)) {
                    pasteInsideButton = new Button("Paste Inside", S.meta64.getNodeFunc(S.edit.cached_pasteSelNodesInside, "S.edit.pasteSelNodesInside", node.id), {
                        className: "highlightBorder",
                        title: "Paste Node(s) you've cut. (Inside this node as more children)"
                    });
                }
            }
        }

        let avatarImg: Img;
        if (this.allowAvatar && node.owner != J.PrincipalName.ADMIN) {
            avatarImg = S.render.makeAvatarImage(node, state);
        }

        let buttonBar = new ButtonBar([openButton, insertNodeButton, createSubNodeButton, editNodeButton, moveNodeUpButton, //
            moveNodeDownButton, cutNodeButton, replyButton, deleteNodeButton, pasteInsideButton], null, "marginLeft");

        let navButtonBar;

        if (isPageRootNode) {
            navButtonBar = new ButtonBar([searchButton, timelineButton, upLevelButton, prevButton, nextButton],
                null, "float-right marginTop marginBottom");
            if (!navButtonBar.childrenExist()) {
                navButtonBar = null;
            }
        }

        if (!buttonBar.childrenExist()) {
            buttonBar = null;
        }

        this.setChildren([selButton, avatarImg, typeIcon, encIcon, sharedIcon, buttonBar, navButtonBar]);
    }
}
