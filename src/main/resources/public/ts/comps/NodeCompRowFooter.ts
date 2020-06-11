import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Div } from "../widget/Div";
import { AppState } from "../AppState";
import { useSelector, useDispatch } from "react-redux";
import { Icon } from "../widget/Icon";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class NodeCompRowFooter extends Div {

    constructor(private node: J.NodeInfo, private isFeed: boolean = false) {
        super(null, {
            className: "header-text"
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let node = this.node;
        let children = [];

        /* We show a simplified header for User Feed rows, because these are always visible and don't need a lot of the info */
        if (this.isFeed) {
                children.push(new Icon({
                    title: "Create a new reply",
                    className: "fa fa-comments fa-lg rowFooterIcon",
                    onClick: () => S.edit.addComment(node, state)
                }));
        }
        else {
           
        }
        this.setChildren(children);
    }
}
