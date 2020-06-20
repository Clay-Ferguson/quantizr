import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Div } from "../widget/Div";
import { Span } from "../widget/Span";
import { AppState } from "../AppState";
import { useSelector, useDispatch } from "react-redux";
import { Img } from "../widget/Img";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompRowHeader extends Div {

    constructor(private node: J.NodeInfo, private isFeed: boolean = false) {
        super(null, {
            className: "header-text"
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let node = this.node;
        let children = [];

        let avatarImg: Img = null;
        if (node.owner != J.PrincipalName.ADMIN) {
            avatarImg = S.render.makeAvatarImage(node, state);
            if (avatarImg) {
                children.push(avatarImg);
            }
        }

        /* We show a simplified header for User Feed rows, because these are always visible and don't need a lot of the info */
        if (this.isFeed) {
            if (node.owner && node.owner != "?") {
                children.push(new Span(node.owner, {
                    className: (node.owner === state.userName) ? "created-by-me" : "created-by-other"
                }));
                children.push(new Span(S.util.formatDate(new Date(node.lastModified)), {
                    className: "marginLeft"
                }));
            }
        }
        else {
            let priority = S.props.getNodePropVal(J.NodeProp.PRIORITY, node);
            priority = (priority && priority != "0") ? " P" + priority : "";

            if (node.owner && node.owner != "?") {
                children.push(new Span(node.owner, {
                    className: (node.owner === state.userName) ? "created-by-me" : "created-by-other"
                }));
            }

            if (node.name) {
                children.push(new Span(node.name, {
                    className: "btn-secondary nodeName"
                }));
            }

            children.push(new Span(
                "ID:" + node.id + " " + //
                ((node.logicalOrdinal != -1) ? ("[" + node.logicalOrdinal + "] ") : " ") + //
                node.type + //
                (node.lastModified ? " " + S.util.formatDate(new Date(node.lastModified)) : "") + //
                priority
            ));
        }
        this.setChildren(children);
    }
}
