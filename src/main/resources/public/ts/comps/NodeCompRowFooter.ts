import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "../widget/Div";
import { Icon } from "../widget/Icon";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class NodeCompRowFooter extends Div {

    constructor(private node: J.NodeInfo, private isFeed: boolean = false) {
        super(null, {
            className: "row-footer"
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let children = [];

        /* We show a simplified header for User Feed rows, because these are always visible and don't need a lot of the info */
        if (this.isFeed) {
            children.push(new Icon({
                title: "Public reply",
                className: "fa fa-comments fa-lg rowFooterIcon",
                onClick: () => S.edit.addComment(this.node, true, state)
            }));

            /* If ActivityPub type is on the node then it makes sense to have a Direct Message option also */
            let apType = S.props.getNodePropVal(J.NodeProp.ACT_PUB_OBJ_TYPE, this.node);
            if (apType) {
                children.push(new Icon({
                    title: "Private Reply (Direct Message)",
                    className: "fa fa-comment fa-lg rowFooterIcon",
                    onClick: () => S.edit.addComment(this.node, false, state)
                }));
            }
        }
        this.setChildren(children);
    }
}
