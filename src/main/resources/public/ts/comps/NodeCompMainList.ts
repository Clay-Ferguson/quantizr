import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Comp } from "../widget/base/Comp";
import { ReactNode } from "react";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { NodeCompRowHeader } from "./NodeCompRowHeader";
import { NodeCompMarkdown } from "./NodeCompMarkdown";
import { NodeCompBinary } from "./NodeCompBinary";
import { Div } from "../widget/Div";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompMainList extends Comp {

    comp: Comp = null;

    //pass data.node into here
    constructor(public rootNode: J.NodeInfo, public newData: boolean, public endReached: boolean) {
        super();
        this.comp = this.build();
    }

    build = (): Comp => {
        let output: Comp[] = [];
        let rootNode = this.rootNode;

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

        //todo-0: how to get this correct INSIDE this compoent
        //this.lastOwner = rootNode.owner;

        //console.log("lastOwner (root)=" + data.node.owner);
        if (rootNode.children) {
            let orderByProp = S.props.getNodePropVal(J.NodeProp.ORDER_BY, rootNode);
            let allowNodeMove: boolean = !orderByProp;
            output.push(S.render.renderChildren(rootNode, this.newData, 1, allowNodeMove));
        }

        if (!this.endReached) {
            let nextButton = new Button("Next Page", S.view.nextPage,
                {
                    id: "nextPageButton",
                    iconclass: "fa fa-angle-right fa-lg"
                });

            //todo-1: last page button disabled pending refactoring
            //let lastButton = this.makeButton("Last Page", "lastPageButton", this.lastPage);
            output.push(new ButtonBar([nextButton], "text-center marginTop"));
        }

        return new Div(null, null, output);
    }

    compRender = (): ReactNode => {
        /* Delegate rendering to comp */
        return this.comp.compRender();
    }
}
