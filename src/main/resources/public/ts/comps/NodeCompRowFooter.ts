import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "../widget/Anchor";
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

        // When rendering local Quanta nodes, on the browser, we have no need to show a LINK to the parent node, or a link
        // to the actual node because all that's internal.
        if (this.node.owner.indexOf("@") !== -1) {
            let inReplTo = S.props.getNodePropVal(J.NodeProp.ACT_PUB_OBJ_INREPLYTO, this.node);
            if (inReplTo) {
                children.push(new Anchor(inReplTo, "Parent", {
                    className: "footerLink",
                    target: "_blank"
                }));
            }

            let objUrl = S.props.getNodePropVal(J.NodeProp.ACT_PUB_OBJ_URL, this.node);
            if (objUrl) {
                children.push(new Anchor(objUrl, "Link", {
                    className: "footerLink",
                    target: "_blank"
                }));
            }
        }
        this.setChildren(children);
    }
}
