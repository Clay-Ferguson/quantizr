import { AppState } from "../AppState";
import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { TabDataIntf } from "../intf/TabDataIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

export class IPFSNodeTypeHandler extends TypeBase {

    constructor() {
        super(J.NodeType.IPFS_NODE, "IPFS Node", "fa-sitemap", false);
    }

    allowPropertyEdit(propName: string): boolean {
        return true;
    }

    render(node: J.NodeInfo, tabData: TabDataIntf<any>, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        let ret: Comp[] = [];

        let cid = S.props.getNodePropVal(J.NodeProp.IPFS_CID, node) || "";
        ret.push(new Heading(6, "CID: " + cid, { className: "ipfs-text" }));

        return new Div(null, null, ret);
    }
}
