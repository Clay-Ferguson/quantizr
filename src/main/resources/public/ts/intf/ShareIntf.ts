import * as I from "../Interfaces";
import * as J from "../JavaIntf";

export interface ShareIntf {

    sharingNode: I.NodeInfo;
    editNodeSharing(): void;
    findSharedNodes(): void;
}
