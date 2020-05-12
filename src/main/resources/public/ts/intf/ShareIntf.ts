import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { AppState } from "../AppState";

export interface ShareIntf {
    editNodeSharing(state: AppState): void;
    findSharedNodes(state: AppState, shareTarget: string): void;
    addCipherKeyToNode(node: J.NodeInfo, principalPublicKeyStr: string, principalNodeId: string): Promise<void>;
}
