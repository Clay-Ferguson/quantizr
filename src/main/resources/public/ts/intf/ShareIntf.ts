import * as I from "../Interfaces";
import * as J from "../JavaIntf";

export interface ShareIntf {
    editNodeSharing(): void;
    findSharedNodes(): void;
    addCipherKeyToNode(node: J.NodeInfo, principalPublicKeyStr: string, principleNodeId: string): Promise<void>;
}
