import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { SharesRSInfo } from "../../SharesRSInfo";
import { S } from "../../Singletons";
import { SharedNodesResultSetView } from "../SharedNodesResultSetView";
import * as J from "../../JavaIntf";

export class SharedNodesResultSetViewData implements TabIntf<SharesRSInfo> {
    name = "Shared Nodes";
    tooltip = "Shows all the Shared nodes made accessible to other users";
    id = C.TAB_SHARES;
    isVisible = (state: AppState) => S.tabUtil.resultSetHasData(C.TAB_SHARES);
    constructView = (data: TabIntf) => new SharedNodesResultSetView<SharesRSInfo>(data);
    getTabSubOptions = (state: AppState): Div => { return null; };
    props = new SharesRSInfo();
    scrollPos: 0;
    openGraphComps: [];

    static inst: SharedNodesResultSetViewData = null;
    constructor() {
        SharedNodesResultSetViewData.inst = this;
    }

    findNode = (nodeId: string): J.NodeInfo => {
        return this.props.results.find(n => n.id === nodeId);
    }

    nodeDeleted = (nodeId: string): void => {
        this.props.results = this.props.results.filter(n => nodeId !== n.id);
    }
}
