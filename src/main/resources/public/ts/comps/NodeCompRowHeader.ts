import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import { NodeActionType } from "../enums/NodeActionType";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "../widget/Div";
import { Icon } from "../widget/Icon";
import { IconButton } from "../widget/IconButton";
import { Img } from "../widget/Img";
import { Span } from "../widget/Span";

// todo-1: need to switch to the more efficient way of using nid attribute
// on elements (search for "nid:" in code), to avoid creating new functions
// every time this component renders (and same for entire app!)

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompRowHeader extends Div {

    constructor(private node: J.NodeInfo, private allowAvatars: boolean, private isMainTree: boolean, private isFeed: boolean = false, private jumpButton: boolean = false) {
        super(null, {
            className: "header-text"
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let node = this.node;
        let children = [];
        let avatarImg: Img = null;

        if (this.allowAvatars && node.owner !== J.PrincipalName.ADMIN) {
            avatarImg = S.render.makeAvatarImage(node, state);
            if (avatarImg) {
                children.push(avatarImg);
            }
        }

        let priorityVal = S.props.getNodePropVal(J.NodeProp.PRIORITY, node);
        let priority = (priorityVal && priorityVal !== "0") ? "P" + priorityVal : "";

        // now that we have this stuff visible by default on all nodes, we don't want users to need to
        // see 'admin' on all admin nodes. too noisy
        if (node.owner && node.owner !== "?" && node.owner !== "admin") {
            let displayName = node.displayName || ("@" + node.owner);
            children.push(new Span(displayName, {
                className: (node.owner === state.userName) ? "created-by-me" : "created-by-other",
                title: "Show Profile",
                onClick: (evt: any) => {
                    new UserProfileDlg(node.ownerId, state).open();
                }
            }));
        }

        if (node.name) {
            children.push(new Span(node.name, {
                className: "btn-secondary nodeName",
                title: "Copy name-based URL to clipboard",
                onClick: () => {
                    let url = window.location.origin + S.util.getPathPartForNamedNode(node);
                    S.util.copyToClipboard(url);
                    S.util.flashMessage("Copied to Clipboard: " + url, "Clipboard", true);
                }
            }));
        }

        /* for admin user shwo id, ordinal, and type right on the row. We have a bug where
        the logicalOrdinal is showing as -1 here, but it's just because it's not being set on the server. */
        if (state.isAdminUser) {
            // looks like root node of pages don't have this ordinal set (it's -1 so for now we just hide it in that case)
            let ordinal = node.logicalOrdinal === -1 ? "" : node.logicalOrdinal;
            children.push(new Span(ordinal + " " + node.type, { className: "marginRight" }));
        }

        children.push(new Icon({
            className: "fa fa-link fa-lg marginRight",
            title: "Show URLs for this node",
            onClick: () => S.render.showNodeUrl(node, state)
        }));

        children.push(new Icon({
            className: "fa fa-bookmark fa-lg",
            title: "Bookmark this Node",
            onClick: () => S.edit.addBookmark(node, state)
        }));

        if (priority) {
            children.push(new Span(priority, {
                className: "priorityTag" + priorityVal
            }));
        }

        let floatUpperRightDiv: Div = new Div(null, {
            className: "float-right"
        });

        if (node.lastModified) {
            floatUpperRightDiv.addChild(new Span(S.util.formatDate(new Date(node.lastModified))));
        }

        if (S.props.isPublic(node)) {
            floatUpperRightDiv.addChild(new Icon({
                className: "fa fa-globe fa-lg iconMarginLeft",
                title: "Node is Public\n(Shared to everyone)"
            }));
        }
        else if (S.props.isShared(node)) {
            let allSharingNames = S.util.getSharingNames(node, true);
            let sharingNames = allSharingNames;
            let isPublic = sharingNames.toLowerCase().indexOf("public") !== -1;

            let nlIdx = sharingNames.indexOf("\n");
            if (nlIdx !== -1) {
                sharingNames = sharingNames.substring(nlIdx) + "+";
            }
            floatUpperRightDiv.addChild(
                new Span(null, {
                    className: isPublic ? "sharingNamesDispPublic" : "sharingNamesDisp",
                    title: "Shared to:\n\n" + allSharingNames
                }, [

                    // shos sharing names only if not public
                    !isPublic ? new Span(sharingNames) : null,
                    new Icon({
                        className: "fa fa-envelope fa-lg iconMarginLeft"
                    })
                ]));
        }

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

        /* Note: if this is on the main tree then we don't show the edit button here because it'll be
        showing up in a different place. We show here only for timeline, or search results views */
        if (!this.isMainTree && state.userPreferences.editMode) {
            if (editingAllowed && editableNode) {
                floatUpperRightDiv.addChild(new Span(null, { className: "marginLeft" }, [
                    new IconButton("fa-edit", null, {
                        className: "marginLeft",
                        onClick: S.edit.runEditNodeByClick,
                        title: "Edit Node",
                        nid: node.id
                    })
                ]));
            }

            // DO NOT DELETE:
            // This code works but the renderPageFromData it eventually calls is super tightly coupled to the
            // logic of switching over to the MainTab, which we wouldn't want in this scenario, so until the tab
            // switching is decoupled I'm disabling the ability to delete from a non-Tree Tab view. We got lucky
            // in the "Edit Node" button just above, because that works fine and doesn't switch tabs on us.
            // if (deleteAllowed && node.id !== state.homeNodeId) {
            //     floatUpperRightDiv.addChild(new Icon({
            //         className: "fa fa-trash fa-lg buttonBarIcon",
            //         title: "Delete selected nodes",
            //         nid: node.id,
            //         onClick: S.edit.deleteSelNodes
            //     }));
            // }
        }

        let jumpButtonAdded = false;
        /* If we're not on a search result display (or timeline) and there's a TARGET_ID on the node
        then we need to show the jump button point to it.

        NOTE: todo-1: This logic will be the key to how we can make
        bookmarks work (a future feature). If bookmarks simply have the TARGET_ID then that basically
        can make them functional as bookmarks, because TARGET_ID is essentially all it
        takes to be a functional bookmark to the id.
        */
        if (this.isMainTree) {
            const targetId = S.props.getNodePropVal(J.NodeProp.TARGET_ID, this.node);
            if (targetId) {
                jumpButtonAdded = true;
                floatUpperRightDiv.addChild(new Span(null, { className: "marginLeft" }, [
                    new IconButton("fa-arrow-right", null, {
                        className: "marginLeft",
                        onClick: () => S.view.refreshTree(targetId, true, true, targetId, false, true, true, state),
                        title: "Jump to the Node"
                    })
                ]));
            }
        }

        if (this.jumpButton && !jumpButtonAdded) {
            floatUpperRightDiv.addChild(new Span(null, { className: "marginLeft" }, [
                new IconButton("fa-arrow-right", null, {
                    className: "marginLeft",
                    onClick: () => S.srch.clickSearchNode(node.id, state),
                    title: "Jump to this Node in the Main Tab"
                })
            ]));
        }

        if (floatUpperRightDiv.childrenExist()) {
            children.push(floatUpperRightDiv);
        }

        this.setChildren(children);
    }
}
