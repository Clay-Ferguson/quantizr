import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Div } from "../widget/Div";
import { Icon } from "../widget/Icon";
import { Comp } from "../widget/base/Comp";
import { Button } from "../widget/Button";
import { Checkbox } from "../widget/Checkbox";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { Img } from "../widget/Img";
import { ButtonBar } from "../widget/ButtonBar";
import { HorizontalLayout } from "../widget/HorizontalLayout";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompButtonBar extends Comp {

    comp: HorizontalLayout = null;

    constructor(public node: J.NodeInfo, public editingAllowed: boolean, public allowAvatar: boolean, public allowNodeMove: boolean) {
        super();
        this.comp = this.build();
    }

    build = (): Comp => {
        let node = this.node;

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

        //todo-1: need to DRY up places where this code block is repeated
        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(node.type);
        if (typeHandler) {
            let iconClass = typeHandler.getIconClass(node);
            if (iconClass) {
                typeIcon = new Icon("", null, {
                    "style": { marginRight: '6px', verticalAlign: 'middle' },
                    className: iconClass
                });
            }
        }

        if (S.props.isEncrypted(node)) {
            encIcon = new Icon("", null, {
                "style": { marginRight: '6px', verticalAlign: 'middle' },
                className: "fa fa-lock fa-lg"
            });
        }

        if (S.props.isMine(node) && S.props.isShared(node)) {
            sharedIcon = new Icon("", null, {
                "style": { marginRight: '6px', verticalAlign: 'middle' },
                className: "fa fa-share-alt fa-lg"
            });
        }

        let isInlineChildren = !!S.props.getNodePropVal(J.NodeProp.INLINE_CHILDREN, node);

        /* Construct Open Button.
        We always enable for fs:folder, to that by clicking to open a folder that will cause the server to re-check and see if there are
        truly any files in there or not because we really cannot possibly know until we look. The only way to make this Open button
        ONLY show when there ARE truly children fore sure would be to force a check of the file system for every folder type that is ever rendered
        on a page and we don't want to burn that much CPU just to prevent empty-folders from being explored. Empty folders are rare. */
        if (!isInlineChildren && //
            (node.hasChildren || node.type == "fs:folder" || node.type == "fs:lucene" || node.type == "ipfs:node")) {

            /* convert this button to a className attribute for styles */
            openButton = new Button("Open", () => { S.nav.openNodeById(node.id, true) }, null, "btn-primary");
        }

        /*
         * If in edit mode we always at least create the potential (buttons) for a user to insert content, and if
         * they don't have privileges the server side security will let them know. In the future we can add more
         * intelligence to when to show these buttons or not.
         */
        if (S.meta64.userPreferences.editMode) {
            // console.log("Editing allowed: " + nodeId);

            let selected: boolean = S.meta64.selectedNodes[node.id] ? true : false;

            if (this.editingAllowed && S.render.allowAction(typeHandler, "edit")) {
                selButton = new Checkbox(null, selected, {
                    onChange: () => {
                        S.nav.toggleNodeSel(selButton.getChecked(), node.id)
                    },
                });
            }

            let insertAllowed = true;
            if (typeHandler) {
                insertAllowed = typeHandler.allowAction("insert");
            }

            if (C.NEW_ON_TOOLBAR && insertAllowed && S.edit.isInsertAllowed(node)) {
                createSubNodeButton = new Button("New", () => { S.edit.createSubNode(node.id, null, true); });
            }

            if (C.INS_ON_TOOLBAR) {
                insertNodeButton = new Button("Ins", () => { S.edit.insertNode(node.id); });
            }

            if (this.editingAllowed) {
                editNodeButton = new Button(null, () => { S.edit.runEditNode(node.id); }, {
                    "iconclass": "fa fa-edit fa-lg"
                });

                //todo-0: get enablement correct for this (or visibility)
                if (node.type != J.NodeType.REPO_ROOT) {
                    cutNodeButton = new Button(null, () => { S.edit.cutSelNodes(node); }, {
                        "iconclass": "fa fa-cut fa-lg"
                    });
                }

                if (C.MOVE_UPDOWN_ON_TOOLBAR && this.allowNodeMove) {

                    if (!node.firstChild) {
                        moveNodeUpButton = new Button(null, () => { S.edit.moveNodeUp(node.id); }, {
                            "iconclass": "fa fa-arrow-up fa-lg"
                        });
                    }

                    if (!node.lastChild) {
                        moveNodeDownButton = new Button(null, () => { S.edit.moveNodeDown(node.id); }, {
                            "iconclass": "fa fa-arrow-down fa-lg"
                        });
                    }
                }

                deleteNodeButton = new Button(null, () => { S.edit.deleteSelNodes(node, false); }, {
                    "iconclass": "fa fa-trash fa-lg"
                });

                if (!S.meta64.isAnonUser && S.edit.nodesToMove != null && (S.meta64.state.selNodeIsMine || S.meta64.state.homeNodeSelected)) {
                    pasteInsideButton = new Button("Paste Inside", () => { S.edit.pasteSelNodes(node, 'inside'); }, {
                        className: "highlightBorder"
                    });
                }
            }
        }

        let avatarImg: Img;
        //console.log("node.owner[" + node.id + "]=" + node.owner + " ownerId=" + node.ownerId + " allowAvatar=" + allowAvatar);
        if (this.allowAvatar && node.owner != J.PrincipalName.ADMIN) {
            avatarImg = S.render.makeAvatarImage(node);
        }

        let buttonBar = new ButtonBar([openButton, insertNodeButton, createSubNodeButton, editNodeButton, moveNodeUpButton, //
            moveNodeDownButton, cutNodeButton, replyButton, deleteNodeButton, pasteInsideButton], null, "marginLeft marginTop");

        if (selButton || typeIcon || encIcon || sharedIcon) {
            return new HorizontalLayout([selButton, avatarImg, typeIcon, encIcon, sharedIcon, buttonBar], "marginLeft");
        }
        else {
            return new HorizontalLayout([avatarImg, buttonBar], "marginLeft");
        }
    }

    compRender = () : ReactNode => {
        /* Delegate rendering to comp */
        return this.comp.compRender();
    }
}
