import * as I from "../Interfaces";

export interface ShareIntf {

    sharingNode: I.NodeInfo;
    editNodeSharing(): void;
    findSharedNodes(): void;
}
