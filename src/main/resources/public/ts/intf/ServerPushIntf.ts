import { AppState } from "../AppState";
import * as J from "../JavaIntf";
import { TabDataIntf } from "./TabDataIntf";

export interface ServerPushIntf {
    init(): any;
    close(): any;
    forceFeedItem(nodeInfo: J.NodeInfo, feedData: TabDataIntf, state: AppState): void;
}
