import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { ButtonBar } from "../widget/ButtonBar";
import { Clearfix } from "../widget/Clearfix";
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
        super(null, { key: "nodeCompMaiList" });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);

        let children: Comp[] = [];
        if (state.node && state.node.children) {
            this.addPaginationButtons(children, state.endReached, "", state);

            let orderByProp = S.props.getNodePropVal(J.NodeProp.ORDER_BY, state.node);
            let allowNodeMove: boolean = !orderByProp;
            children.push(S.render.renderChildren(state.node, 1, allowNodeMove, state));

            this.addPaginationButtons(children, state.endReached, "marginTop marginBottom", state);
        }

        // No longer needed, because we have this on the menu now but check that all the gettingStarted (from yaml) content
        // is indeed mentioned in the User Guide (todo-1)
        // children.push(new CollapsibleHelpPanel("Getting Started", S.meta64.config.help.gettingStarted,
        //     (state: boolean) => {
        //         NodeCompMainList.helpExpanded = state;
        //     }, NodeCompMainList.helpExpanded));

        this.setChildren(children);
    }

    addPaginationButtons = (children: Comp[], endReached: boolean, moreClasses: string, state: AppState) => {
        let firstButton: Comp;
        let prevButton: Comp;
        let nextButton: Comp;
        let firstChild: J.NodeInfo = S.edit.getFirstChildNode(state);

        if (firstChild && firstChild.logicalOrdinal > 1) {
            firstButton = new IconButton("fa-angle-double-left", null, {
                onClick: () => S.view.firstPage(state),
                title: "First Page"
            });
        }

        if (firstChild && firstChild.logicalOrdinal > 0) {
            prevButton = new IconButton("fa-angle-left", null, {
                onClick: () => S.view.prevPage(state),
                title: "Previous Page"
            });
        }

        if (!endReached) {
            nextButton = new IconButton("fa-angle-right", "More", {
                onClick: (event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    S.view.nextPage(state);
                },
                title: "Next Page"
            });
        }

        if (firstButton || prevButton || nextButton) {
            children.push(new ButtonBar([firstButton, prevButton, nextButton], "text-center " + moreClasses));
            children.push(new Clearfix());
        }
    }
}
