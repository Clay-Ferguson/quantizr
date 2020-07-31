import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Comp } from "../widget/base/Comp";
import { Div } from "../widget/Div";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "../AppState";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompMainList extends Div {

    constructor() {
        super(null);
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let rootNode = state.node;
        let endReached = state.endReached;

        if (!rootNode) {
            this.setChildren(null);
            return;
        }
        let children: Comp[] = [];

        if (rootNode.children) {
            this.addPaginationButtons(children, endReached, state);

            let orderByProp = S.props.getNodePropVal(J.NodeProp.ORDER_BY, rootNode);
            let allowNodeMove: boolean = !orderByProp;
            children.push(S.render.renderChildren(rootNode, 1, allowNodeMove));

            this.addPaginationButtons(children, endReached, state);
        }

        this.setChildren(children);
    }

    addPaginationButtons = (children: Comp[], endReached: boolean, state: AppState) => {
        let firstButton: Comp;
        let prevButton: Comp;
        let nextButton: Comp;

        if (S.nav.mainOffset > 0) {
            firstButton = new Button(null, () => S.view.firstPage(state), {
                title: "First Page",
                id: "firstPageButton",
                iconclass: "fa fa-angle-double-left fa-lg"
            });
            prevButton = new Button(null, () => S.view.prevPage(state), {
                title: "Previous Page",
                id: "prevPageButton",
                iconclass: "fa fa-angle-left fa-lg"
            });
        }

        if (!endReached) {
            nextButton = new Button(null, () => S.view.nextPage(state), {
                title: "Next Page",
                id: "nextPageButton",
                iconclass: "fa fa-angle-right fa-lg"
            });
        }

        if (firstButton || prevButton || nextButton) {
            children.push(new ButtonBar([firstButton, prevButton, nextButton], "text-center marginTop"));
            children.push(new Div(null, { className: "clearfix" }));
        }
    }
}
