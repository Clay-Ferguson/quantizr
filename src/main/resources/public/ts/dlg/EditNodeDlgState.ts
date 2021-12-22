import * as J from "../JavaIntf";

export interface LS { // Local State
    node?: J.NodeInfo;
    selectedProps?: Set<string>;
    toIpfs?: boolean;
    speechActive?: boolean;
}
