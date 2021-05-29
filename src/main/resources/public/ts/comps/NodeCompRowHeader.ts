import { useSelector } from "react-redux";
import { appState } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
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
        // console.log("NodeCompHeaderRow: " + S.util.prettyPrint(node));
        let avatarImg: Img = null;
        // console.log("node.id=" + node.id + " allowAvatar=" + this.allowAvatars);
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
                className: (node.owner === state.userName) ? "created-by-me" : "created-by-other"
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
            className: "fa fa-link fa-lg",
            title: "Show URLs for this node",
            onClick: () => S.render.showNodeUrl(node, state)
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
                style: {
                    marginLeft: "12px",
                    verticalAlign: "middle"
                },
                className: "fa fa-globe fa-lg",
                title: "Node is Public (Shared to everyone)"
            }));
        }
        else if (S.props.isShared(node)) {
            let sharingNames = S.util.getSharingNames(node, true);

            floatUpperRightDiv.addChild(new Icon({
                style: {
                    marginLeft: "12px",
                    verticalAlign: "middle"
                },
                className: "fa fa-envelope fa-lg",
                title: "Shared to:\n\n" + sharingNames
            }));
        }

        let jumpButtonAdded = false;
        /* If we're not on a search result display (or timeline) and there's a TARGET_ID on the node
        then we need to show the jump button point to it.

        NOTE: todo-0: This logic will be the key to how we can make
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
