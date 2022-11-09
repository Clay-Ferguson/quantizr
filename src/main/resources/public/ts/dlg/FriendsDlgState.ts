import * as J from "../JavaIntf";

export interface FriendsDlgState { // Local State
    selections?: Set<string>;
    loading?: boolean;
    friends?: J.FriendInfo[];
}
