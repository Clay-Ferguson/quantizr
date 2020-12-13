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

        if (this.isFeed) {
            children.push(new Icon({
                title: "Public reply",
                className: "fa fa-comments fa-lg rowFooterIcon",
                onClick: () => S.edit.addComment(this.node, true, state)
            }));
        }

        /* If ActivityPub type is on the node then it makes sense to have a Direct Message option also */
        let apObjType = S.props.getNodePropVal(J.NodeProp.ACT_PUB_OBJ_TYPE, this.node);
        let apId = S.props.getNodePropVal(J.NodeProp.ACT_PUB_ID, this.node);

        /* todo-0: is it redundant to check apObjType here? That is: Do all nodes with an apObjType also have an apId? ...because
        if so then this is redundant */
        if (apObjType || apId) {
            children.push(new Icon({
                title: "Private Reply (Direct Message)",
                className: "fa fa-comment fa-lg rowFooterIcon",
                onClick: () => S.edit.addComment(this.node, false, state)
            }));
        }

        this.setChildren(children);
    }
}
