import { Anchor } from "../../comp/core/Anchor";
import { Div } from "../../comp/core/Div";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";

export class NodeCompRowFooter extends Div {

    constructor(private node: J.NodeInfo, private isFeed: boolean = false) {
        super(null, {
            className: "row-footer float-end"
        });
    }

    preRender(): void {
        let children = [];

        /* When rendering local Quanta nodes, on the browser, we have no need to show a LINK to the parent node, or a link
         to the actual node because all that's internal. */
        if (this.node.owner.indexOf("@") !== -1) {
            let inReplTo = S.props.getPropStr(J.NodeProp.ACT_PUB_OBJ_INREPLYTO, this.node);
            if (inReplTo) {
                children.push(new Anchor(inReplTo, "Parent", {
                    className: "footerLink",
                    target: "_blank"
                }));
            }

            let objUrl = S.props.getPropStr(J.NodeProp.ACT_PUB_OBJ_URL, this.node);
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
