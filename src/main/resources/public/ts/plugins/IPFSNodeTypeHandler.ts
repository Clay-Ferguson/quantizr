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
        if (propName === "sn:linkName" || propName === J.NodeProp.IPFS_LINK) {
            return true;
        }
        return false;
    }

    render(node: J.NodeInfo, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        let ret: Comp[] = [];

        let name = node.content;
        if (name) {
            let linkName = S.props.getNodePropVal(J.NodeProp.IPFS_LINK_NAME, node);
            if (linkName) {
                ret.push(new Heading(6, "Link Name: " + linkName, { className: "ipfs-text" }));
            }

            let link = S.props.getNodePropVal(J.NodeProp.IPFS_LINK, node);
            if (link) {
                ret.push(new Heading(6, "Link: " + link, { className: "ipfs-text" }));
            }
            ret.push(new NodeCompMarkdown(node, state));
        }
        else {
            let displayName = S.props.getNodePropVal(J.NodeProp.IPFS_LINK, node);
            // let folderName = "";
            // let displayName = S.props.getNodePropVal(J.NodeProp.IPFS_LINK, node);
            // if (displayName) {
            //     folderName = S.util.getNameFromPath(displayName);
            // }

            ret.push(new Heading(6, "Link: " + displayName, { className: "ipfs-text" }));
        }

        return new Div(null, null, ret);
    }
}
