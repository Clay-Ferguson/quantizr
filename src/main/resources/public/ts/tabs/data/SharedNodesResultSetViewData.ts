import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { SharesRSInfo } from "../../SharesRSInfo";
import { S } from "../../Singletons";
import { SharedNodesResultSetView } from "../SharedNodesResultSetView";

export class SharedNodesResultSetViewData implements TabIntf {
    name = "Shared Nodes";
    id = C.TAB_SHARES;
    isVisible = (state: AppState) => S.tabUtil.resultSetHasData(C.TAB_SHARES);
    constructView = (data: TabIntf) => new SharedNodesResultSetView<SharesRSInfo>(data);
    getTabSubOptions = (state: AppState): Div => { return null; };
    rsInfo = new SharesRSInfo();
    scrollPos: 0;
    props: {};
    openGraphComps: [];
}
