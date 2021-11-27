import { AppState } from "../AppState";
import { NodeCompMarkdown } from "../comps/NodeCompMarkdown";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class IPFSNodeTypeHandler extends TypeBase {

    constructor() {
        super(J.NodeType.IPFS_NODE, "IPFS Node", "fa-sitemap", false);
    }

    allowPropertyEdit(propName: string): boolean {
        return true;
    }

    render(node: J.NodeInfo, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        let ret: Comp[] = [];

        let cid = S.props.getNodePropVal(J.NodeProp.IPFS_CID, node) || "";
        ret.push(new Heading(6, "CID: " + cid, { className: "ipfs-text" }));

        return new Div(null, null, ret);
    }
}
