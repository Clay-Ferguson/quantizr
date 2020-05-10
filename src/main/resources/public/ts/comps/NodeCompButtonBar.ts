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
import { SearchContentDlg } from "../dlg/SearchContentDlg";
import { AppState } from "../AppState";
import { useSelector, useDispatch } from "react-redux";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompButtonBar extends HorizontalLayout {

    constructor(public node: J.NodeInfo, public allowAvatar: boolean, public allowNodeMove: boolean, public isRootNode: boolean) {
        super(null, "marginLeft");
    }

    preRender = (): void => {
        let state: AppState = useSelector((state: AppState) => state);
        let node = this.node;
        if (!node) {
            this.children = null;
            return;
        }

        let highlightNode = S.meta64.getHighlightedNode(state);
        let homeNodeSelected = highlightNode != null && state.homeNodeId == highlightNode.id;

        //console.log("NodeCompButtonBar_[" + node.id + "] editMode=" + state.userPreferences.editMode);

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

        if (this.isRootNode && S.nav.parentVisibleToUser(state)) {
            upLevelButton = new NavBarIconButton("fa-chevron-circle-up", "Up Level", {
                "onClick": e => { S.nav.navUpLevel(state); },
                "title": "Go to Parent SubNode"
            }, null, null, "");
        }

        if (this.isRootNode && !S.nav.displayingRepositoryRoot(state)) {
            prevButton = new NavBarIconButton("fa-chevron-circle-left", null, {
                "onClick": e => { S.nav.navToSibling(-1, state); },
                "title": "Go to Previous SubNode"
            }, null, null, "");

            nextButton = new NavBarIconButton("fa-chevron-circle-right", null, {
                "onClick": e => { S.nav.navToSibling(1, state); },
                "title": "Go to Next SubNode"
            }, null, null, "");
        }

        if (this.isRootNode && !state.isAnonUser) {
            searchButton = new NavBarIconButton("fa-search", null, {
                "onClick": e => {
                    S.nav.clickOnNodeRow(node, state);
                    new SearchContentDlg(state).open();
                },
                "title": "Search under this node"
            }, null, null, "");


            timelineButton = new NavBarIconButton("fa-clock-o", null, {
                "onClick": e => {
                    S.nav.clickOnNodeRow(node, state);
                    S.srch.timeline("mtm", state);
                },
                "title": "View Timeline under this node (by Mod Time)"
            }, null, null, "");
        }

        //todo-1: need to DRY up places where this code block is repeated
        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(node.type);
        if (typeHandler) {
            let iconClass = typeHandler.getIconClass(node);
            if (iconClass) {
                typeIcon = new Icon({
                    "style": { marginRight: '6px', verticalAlign: 'middle' },
                    className: iconClass
                });
            }
        }

        let editingAllowed = S.edit.isEditAllowed(node, state);
        if (typeHandler) {
            editingAllowed = editingAllowed && typeHandler.allowAction("edit");
        }

        if (S.props.isEncrypted(node)) {
            encIcon = new Icon({
                "style": { marginRight: '6px', verticalAlign: 'middle' },
                className: "fa fa-lock fa-lg"
            });
        }

        if (S.props.isMine(node, state) && S.props.isShared(node)) {
            sharedIcon = new Icon({
                "style": { marginRight: '6px', verticalAlign: 'middle' },
                className: "fa fa-share-alt fa-lg"
            });
        }

        //let isInlineChildren = !!S.props.getNodePropVal(J.NodeProp.INLINE_CHILDREN, node);

        /* Construct Open Button.
        We always enable for fs:folder, to that by clicking to open a folder that will cause the server to re-check and see if there are
        truly any files in there or not because we really cannot possibly know until we look. The only way to make this Open button
        ONLY show when there ARE truly children fore sure would be to force a check of the file system for every folder type that is ever rendered
        on a page and we don't want to burn that much CPU just to prevent empty-folders from being explored. Empty folders are rare. */
        if (!this.isRootNode && //!isInlineChildren && //
            (node.hasChildren || node.type == "fs:folder" || node.type == "fs:lucene" || node.type == "ipfs:node")) {

            /* convert this button to a className attribute for styles */
            openButton = new Button("Open", () => { S.nav.openNodeById(node.id, state) }, null, "btn-primary");
        }

        /*
         * If in edit mode we always at least create the potential (buttons) for a user to insert content, and if
         * they don't have privileges the server side security will let them know. In the future we can add more
         * intelligence to when to show these buttons or not.
         */
        if (state.userPreferences.editMode) {
            // console.log("Editing allowed: " + nodeId);

            let selected: boolean = state.selectedNodes[node.id] ? true : false;

            if (editingAllowed && S.render.allowAction(typeHandler, "edit")) {
                selButton = new Checkbox(null, selected, {
                    onChange: () => {
                        S.nav.toggleNodeSel(selButton.getChecked(), node.id, state)
                    },
                });
            }

            let insertAllowed = true;
            if (typeHandler) {
                insertAllowed = typeHandler.allowAction("insert");
            }

            if (C.NEW_ON_TOOLBAR && insertAllowed && S.edit.isInsertAllowed(node, state) &&
                //not page root node 'or' page no children exist.
                (node.id != state.node.id || !node.children || node.children.length == 0)) {
                createSubNodeButton = new Button("New", () => { S.edit.createSubNode(node.id, null, true, state); });
            }

            if (C.INS_ON_TOOLBAR) {
                insertNodeButton = new Button("Ins", () => { S.edit.insertNode(node.id, null, 0, state); });
            }

            if (editingAllowed) {
                editNodeButton = new Button(null, () => { S.edit.runEditNode(node.id, state); }, {
                    "iconclass": "fa fa-edit fa-lg"
                });

                if (!this.isRootNode && node.type != J.NodeType.REPO_ROOT && !state.nodesToMove) {
                    cutNodeButton = new Button(null, () => { S.edit.cutSelNodes(node, state); }, {
                        "iconclass": "fa fa-cut fa-lg"
                    });
                }

                if (C.MOVE_UPDOWN_ON_TOOLBAR && this.allowNodeMove) {

                    if (!node.firstChild) {
                        moveNodeUpButton = new Button(null, () => { S.edit.moveNodeUp(node.id, state); }, {
                            "iconclass": "fa fa-arrow-up fa-lg"
                        });
                    }

                    if (!node.lastChild) {
                        moveNodeDownButton = new Button(null, () => { S.edit.moveNodeDown(node.id, state); }, {
                            "iconclass": "fa fa-arrow-down fa-lg"
                        });
                    }
                }

                //not user's account node!
                if (node.id != state.homeNodeId) {
                    deleteNodeButton = new Button(null, () => { S.edit.deleteSelNodes(node, false, state); }, {
                        "iconclass": "fa fa-trash fa-lg"
                    });
                }

                if (!state.isAnonUser && state.nodesToMove != null && (S.props.isMine(node, state) || node.id == state.homeNodeId)) {
                    pasteInsideButton = new Button("Paste Inside", () => { S.edit.pasteSelNodes(node, 'inside', state.nodesToMove, state); }, {
                        className: "highlightBorder"
                    });
                }
            }
        }

        let avatarImg: Img;
        //console.log("node.owner[" + node.id + "]=" + node.owner + " ownerId=" + node.ownerId + " allowAvatar=" + allowAvatar);
        if (this.allowAvatar && node.owner != J.PrincipalName.ADMIN) {
            avatarImg = S.render.makeAvatarImage(node, state);
        }

        let buttonBar = new ButtonBar([openButton, insertNodeButton, createSubNodeButton, editNodeButton, moveNodeUpButton, //
            moveNodeDownButton, cutNodeButton, replyButton, deleteNodeButton, pasteInsideButton], null, "marginLeft marginTop");

        let navButtonBar;

        if (this.isRootNode) {
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
