import { AppState } from "../AppState";
import * as J from "../JavaIntf";

export interface ShareIntf {
    editNodeSharing(state: AppState, node?: J.NodeInfo): void;
    findSharedNodes(state: AppState, shareTarget: string, accessOption: string): void;
    addCipherKeyToNode(node: J.NodeInfo, principalPublicKeyStr: string, principalNodeId: string): Promise<void>;
}
