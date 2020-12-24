import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "../widget/Div";
import { Img } from "../widget/Img";
import { Span } from "../widget/Span";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompRowHeader extends Div {

    constructor(private node: J.NodeInfo, private allowAvatars: boolean, private isFeed: boolean = false) {
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
        if ((this.allowAvatars || node.id === state.node.id) && node.owner !== J.PrincipalName.ADMIN) {
            avatarImg = S.render.makeAvatarImage(node, state);
            if (avatarImg) {
                children.push(avatarImg);
            }
        }

        /* We show a simplified header for User Feed rows, because these are always visible and don't need a lot of the info */
        if (this.isFeed) {
            if (node.owner && node.owner !== "?") {
                children.push(new Span(node.owner, {
                    className: (node.owner === state.userName) ? "created-by-me" : "created-by-other"
                }));
                children.push(new Span(S.util.formatDate(new Date(node.lastModified)), {
                    className: "marginLeft",
                    title: "Last Modified"
                }));
            }
        }
        else {
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
                    title: "Click -> URL into clipboard",
                    onClick: () => {
                        let url = window.location.origin + S.util.getPathPartForNamedNode(node);
                        S.util.copyToClipboard(url);
                        S.util.flashMessage("Copied to Clipboard: " + url, "Clipboard", true);
                    }
                }));
            }

            children.push(new Span(
                node.id + "-" + node.logicalOrdinal + " " + (node.type === "u" ? "" : node.type), //
                {
                    title: "Click -> URL into clipboard",
                    onClick: () => {
                        let url = window.location.origin + "/app?id=" + node.id;
                        S.util.copyToClipboard(url);
                        S.util.flashMessage("Copied to Clipboard: " + url, "Clipboard", true);
                    }
                }
            ));

            if (node.lastModified) {
                children.push(new Span(S.util.formatDate(new Date(node.lastModified)), {
                    className: "float-right"
                }));
            }

            if (priority) {
                children.push(new Span(priority, {
                    className: "priorityTag" + priorityVal
                }));
            }
        }

        let sharingNames = S.util.getSharingNames(node);
        if (sharingNames) {
            children.push(new Span("(Shared to: " + sharingNames + ")"));
        }

        this.setChildren(children);
    }
}
