import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Comp } from "../widget/base/Comp";
import { ReactNode } from "react";
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

    //pass data.node into here
    constructor() {
        super();
    }

    super_CompRender: any = this.compRender;
    compRender = (): ReactNode => {
        let rootNode = useSelector((state: AppState) => state.node);
        let endReached = useSelector((state: AppState) => state.endReached);

        if (!rootNode) {
            //console.log("NodeCompMainList.build: null. Nothing to render");
            return this.super_CompRender();;
        }
        let output: Comp[] = [];

        if (S.nav.mainOffset > 0) {
            let firstButton: Comp = new Button("First Page", S.view.firstPage,
                {
                    id: "firstPageButton",
                    iconclass: "fa fa-angle-double-left fa-lg"
                });
            let prevButton: Comp = new Button("Prev Page", S.view.prevPage,
                {
                    id: "prevPageButton",
                    iconclass: "fa fa-angle-left fa-lg"
                });
            output.push(new ButtonBar([firstButton, prevButton], "text-center marginTop"));
        }

        output.push(new Div(null, { className: "clearfix" }));

        //this.lastOwner = rootNode.owner;

        //console.log("lastOwner (root)=" + data.node.owner);
        if (rootNode.children) {
            let orderByProp = S.props.getNodePropVal(J.NodeProp.ORDER_BY, rootNode);
            let allowNodeMove: boolean = !orderByProp;
            output.push(S.render.renderChildren(rootNode, 1, allowNodeMove));
        }

        if (!endReached) {
            let nextButton = new Button("Next Page", S.view.nextPage,
                {
                    id: "nextPageButton",
                    iconclass: "fa fa-angle-right fa-lg"
                });

            //todo-1: last page button disabled pending refactoring
            //let lastButton = this.makeButton("Last Page", "lastPageButton", this.lastPage);
            output.push(new ButtonBar([nextButton], "text-center marginTop"));
        }

        this.setChildren(output);

        return this.super_CompRender();
    }
}
