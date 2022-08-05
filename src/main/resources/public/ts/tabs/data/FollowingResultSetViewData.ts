import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { FollowingRSInfo } from "../../FollowingRSInfo";
import { TabIntf } from "../../intf/TabIntf";
import { S } from "../../Singletons";
import { FollowingResultSetView } from "../FollowingResultSetView";

export class FollowingResultSetViewData implements TabIntf {
    name = "Following";
    tooltip = "List of people the person is following";
    id = C.TAB_FOLLOWING;
    rsInfo = new FollowingRSInfo();
    scrollPos = 0;
    props = {};
    openGraphComps: OpenGraphPanel[] = [];

    isVisible = (state: AppState) => S.tabUtil.resultSetHasData(C.TAB_FOLLOWING);
    constructView = (data: TabIntf) => new FollowingResultSetView<FollowingRSInfo>(data);
    getTabSubOptions = (state: AppState): Div => { return null; };
}
