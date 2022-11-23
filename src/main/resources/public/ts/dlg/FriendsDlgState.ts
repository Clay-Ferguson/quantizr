import * as J from "../JavaIntf";

export interface FriendsDlgState { // Local State
    nodeId?: string;
    selections?: Set<string>;
    loading?: boolean;
    friends?: J.FriendInfo[];
}
