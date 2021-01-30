import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { ButtonBar } from "../widget/ButtonBar";
import { CollapsibleHelpPanel } from "../widget/CollapsibleHelpPanel";
import { Div } from "../widget/Div";
import { IconButton } from "../widget/IconButton";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompMainList extends Div {
    static helpExpanded: boolean = false;

    constructor() {
        super(null);
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);

        let children: Comp[] = [];
        if (state.node && state.node.children) {
            this.addPaginationButtons(children, state.endReached, state);

            let orderByProp = S.props.getNodePropVal(J.NodeProp.ORDER_BY, state.node);
            let allowNodeMove: boolean = !orderByProp;
            children.push(S.render.renderChildren(state.node, 1, allowNodeMove));

            this.addPaginationButtons(children, state.endReached, state);
        }

        children.push(new CollapsibleHelpPanel("Getting Started", "<h3>Getting Started</h3> " +
        "After logged in: To create your first Social Media post, click the <b>'Feed'</b> tab, and then click <b>'New Post'</b>, enter a messsage, and click <b>'Save'</b><p> " +
        "<p>--OR--<p> Turn on <b>'Edit Mode'</b> by clicking the <b>pencil icon</b> on the right-hand side of the page. This will allow you to start creating, editing, and sharing nodes. " +
        "<h4>Public Posts</h4>" +
        "Any nodes you Share to 'Public' (using Share button on the Editor Dialog) will show up in everyone elses Feed tab automatically.<p> " +
        "<h4>Private Posts</h4>" +
        "To share a node only to specific people, use the Share button on the node and add them. That will post to their feed and also if " +
        "they want they can use the 'direct link' to any node to go directly to it in the future without going thru their Feed tab.<p> " +
        "<p>If you get lost, click the 'cylinder' icon to get back to your Account Node.<p> " +
        "To learn more click <b>'Site Nav &rarr; User Guide'</b> ",
            (state: boolean) => {
                NodeCompMainList.helpExpanded = state;
            }, NodeCompMainList.helpExpanded));

        this.setChildren(children);
    }

    addPaginationButtons = (children: Comp[], endReached: boolean, state: AppState) => {
        let firstButton: Comp;
        let prevButton: Comp;
        let nextButton: Comp;
        let firstChild: J.NodeInfo = S.edit.getFirstChildNode(state);

        if (firstChild && firstChild.logicalOrdinal > 0) {
            firstButton = new IconButton("fa-angle-double-left", null, {
                onClick: () => S.view.firstPage(state),
                title: "First Page"
            });

            prevButton = new IconButton("fa-angle-left", null, {
                onClick: () => S.view.prevPage(state),
                title: "Previous Page"
            });
        }

        if (!endReached) {
            nextButton = new IconButton("fa-angle-right", "More", {
                onClick: () => S.view.nextPage(state),
                title: "Next Page"
            });
        }

        if (firstButton || prevButton || nextButton) {
            children.push(new ButtonBar([firstButton, prevButton, nextButton], "text-center marginTop marginBottom"));
            children.push(new Div(null, { className: "clearfix" }));
        }
    }
}
