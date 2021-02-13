import { useSelector } from "react-redux";
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

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompRowHeader extends Div {

    constructor(private node: J.NodeInfo, private allowAvatars: boolean, private isFeed: boolean = false, private jumpButton: boolean = false) {
        super(null, {
            className: "header-text"
        });
    }

    // todo-0: make all these calls able to log a good exception message (including classname mainly) when there's a NPE or exception
    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let node = this.node;
        let children = [];
        // console.log("NodeCompHeaderRow: " + S.util.prettyPrint(node));
        let avatarImg: Img = null;
        if (this.allowAvatars && node.owner !== J.PrincipalName.ADMIN) {
            avatarImg = S.render.makeAvatarImage(node, state);
            if (avatarImg) {
                children.push(avatarImg);
            }
        }

        let priorityVal = S.props.getNodePropVal(J.NodeProp.PRIORITY, node);
        let priority = (priorityVal && priorityVal !== "0") ? "P" + priorityVal : "";

        if (node.owner && node.owner !== "?") {
            children.push(new Span(node.owner, {
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
            children.push(new Span(node.logicalOrdinal + " " + node.type, { className: "marginRight" }));
        }

        children.push(new Icon({
            className: "fa fa-link fa-lg",
            title: "Copy ID-based URL into clipboard",
            onClick: () => {
                let url = window.location.origin + "/app?id=" + node.id;
                S.util.copyToClipboard(url);
                S.util.flashMessage("Copied to Clipboard: " + url, "Clipboard", true);
            }
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
            floatUpperRightDiv.addChild(new Icon({
                style: {
                    marginLeft: "12px",
                    verticalAlign: "middle"
                },
                className: "fa fa-envelope fa-lg",
                title: "Node is Shared"
            }));
        }

        if (this.jumpButton) {
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

        let sharingNames = S.util.getSharingNames(node, false);
        if (sharingNames) {
            children.push(new Span(` (to: ${sharingNames})`));
        }
        this.setChildren(children);
    }
}
